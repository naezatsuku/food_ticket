const ZEN_DIGIT_START = "０".charCodeAt(0);

/** 全角数字を半角数字に正規化する */
export function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - ZEN_DIGIT_START));
}

/** 区切り文字( , 、 / 全角空白 改行 )でテキストを分割する(空断片は除外) */
function splitBySeparators(s: string): string[] {
  return s
    .split(/[,、/　\r\n]+/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

export interface ParsedDate {
  /** 明記されていなければ null(呼び出し側で解決する) */
  year: number | null;
  month: number;
  day: number;
}

/** "9/13"、"9/13(土)"、"2026/9/13"、"9月13日" 等の日付表記を解析する */
export function parseDateText(raw: string): ParsedDate | null {
  const s = normalizeDigits(raw.trim()).replace(/\s*[（(][^）)]*[）)]\s*$/, "");
  const slashMatch = /^([0-9]{1,4})\s*[/／]\s*([0-9]{1,2})(?:\s*[/／]\s*([0-9]{1,2}))?$/.exec(s);
  if (slashMatch) {
    if (slashMatch[3] !== undefined) {
      return { year: Number(slashMatch[1]), month: Number(slashMatch[2]), day: Number(slashMatch[3]) };
    }
    return { year: null, month: Number(slashMatch[1]), day: Number(slashMatch[2]) };
  }
  const kanjiMatch = /^([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日$/.exec(s);
  if (kanjiMatch) {
    return { year: null, month: Number(kanjiMatch[1]), day: Number(kanjiMatch[2]) };
  }
  return null;
}

const DATE_PART_SRC =
  "[0-9０-９]{1,4}\\s*[/／]\\s*[0-9０-９]{1,2}(?:\\s*[/／]\\s*[0-9０-９]{1,2})?|[0-9０-９]{1,2}\\s*月\\s*[0-9０-９]{1,2}\\s*日";

// 直前が数字・コロン・ピリオドの場合は、日付ではなく時刻(HH:MM)の一部なのでマッチさせない
// (例: "11:00/11:00-11:20" の "00/11" を日付と誤認しない)
const DATE_TIME_RANGE_SRC =
  `(?:(?<![0-9０-９:：.])(${DATE_PART_SRC})(?:\\s*[（(][^）)]{0,4}[）)])?\\s*)?` +
  "([0-9０-９]{1,2})\\s*[:：.]\\s*([0-9０-９]{2})\\s*(?:[~〜\\-–ー]|から)\\s*([0-9０-９]{1,2})\\s*[:：.]\\s*([0-9０-９]{2})";

export interface ParsedDateTimeRange {
  /** 日付部分の生テキスト(セルに日付が無ければ null。呼び出し側でプロジェクトの対象日と突き合わせて解決する) */
  dateText: string | null;
  start: string;
  end: string;
}

/**
 * セル内のテキストから「(日付?) 時刻〜時刻」の並びをすべて抜き出す。
 * 区切り文字(, ・全角空白 等)が日付の "/" と衝突しないよう、事前分割はせずテキスト全体を走査する。
 * 抜き出せなかった残りのテキストは leftover として返す(赤ハイライト用)。
 */
export function scanDateTimeRanges(text: string): { ranges: ParsedDateTimeRange[]; leftover: string } {
  const re = new RegExp(DATE_TIME_RANGE_SRC, "g");
  const ranges: ParsedDateTimeRange[] = [];
  let leftover = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const startHour = Number(normalizeDigits(m[2]));
    const startMinute = Number(normalizeDigits(m[3]));
    const endHour = Number(normalizeDigits(m[4]));
    const endMinute = Number(normalizeDigits(m[5]));
    const start = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
    const end = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
    const valid = startMinute <= 59 && endMinute <= 59 && start < end;
    if (valid) {
      ranges.push({ dateText: m[1] ?? null, start, end });
      leftover += text.slice(cursor, m.index);
      cursor = m.index + m[0].length;
    }
    if (m[0].length === 0) re.lastIndex++;
  }
  leftover += text.slice(cursor);
  return { ranges, leftover };
}

/** 単一のセル(通常はワイド形式のヘッダ)から (日付?)時刻レンジ を1つだけ取り出す */
export function parseSingleDateTimeRange(raw: string): ParsedDateTimeRange | null {
  return scanDateTimeRanges(raw).ranges[0] ?? null;
}

export interface AvailabilityParseResult {
  ranges: ParsedDateTimeRange[];
  /** 時刻レンジとして解析できなかった断片(赤くハイライトして手動修正させる対象) */
  unparsedTokens: string[];
}

/** ロング形式のセル(複数の時刻レンジがまとまったテキスト)を解析する */
export function parseAvailabilityCell(cellText: string): AvailabilityParseResult {
  const { ranges, leftover } = scanDateTimeRanges(cellText);
  const unparsedTokens = splitBySeparators(leftover);
  return { ranges, unparsedTokens };
}

/** セルのテキストに時刻レンジが含まれているか(列の役割推定に使う軽量判定) */
export function cellLooksLikeTimeRange(cellText: string): boolean {
  return scanDateTimeRanges(cellText).ranges.length > 0;
}

const NEGATIVE_MARKS = new Set([
  "×",
  "x",
  "X",
  "ｘ",
  "Ｘ",
  "-",
  "ー",
  "−",
  "0",
  "no",
  "NO",
  "不可",
  "××",
]);

/** ワイド形式のマーク(○ ✓ 1 など)が「入れる」を表しているか */
export function isPositiveMark(rawCell: string): boolean {
  const v = rawCell.trim();
  if (v === "") return false;
  return !NEGATIVE_MARKS.has(v);
}
