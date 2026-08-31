import type { AvailabilityRange } from "../types";

const ZEN_DIGIT_START = "０".charCodeAt(0);

/** 全角数字を半角数字に正規化する */
export function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - ZEN_DIGIT_START));
}

/**
 * "9/13 10:00~11:40" のように時刻レンジの直前に付く日付らしき接頭辞
 * ( 9/13 、9/13(土)、2026/9/13 、9月13日 など)を取り除く。
 * このアプリは日付を扱わない(1日単位)ため、日付部分は無視して時刻だけを残す。
 * 区切り文字の "/" が "9/13" の "/" と衝突して誤分割されるのを防ぐため、
 * 分割より前に適用する。
 */
const DATE_PREFIX_RE =
  /[0-9０-９]{1,4}\s*[/／]\s*[0-9０-９]{1,2}(?:\s*[/／]\s*[0-9０-９]{1,2})?|[0-9０-９]{1,2}\s*月\s*[0-9０-９]{1,2}\s*日/;
// 直前が数字・コロン・ピリオドの場合は、日付ではなく時刻(HH:MM)の一部なのでマッチさせない
// (例: "11:00/11:00-11:20" の "00/11" を日付と誤認しない)
const DATE_PREFIX_BEFORE_TIME_RE = new RegExp(
  `(?<![0-9０-９:：.])(?:${DATE_PREFIX_RE.source})(?:\\s*[（(][^）)]{0,4}[）)])?\\s*(?=[0-9０-９]{1,2}\\s*[:：.])`,
  "g"
);

/** 時刻レンジの直前に付く日付らしき接頭辞を取り除く */
export function stripDatePrefixes(s: string): string {
  return s.replace(DATE_PREFIX_BEFORE_TIME_RE, "");
}

/** 区切り文字( , 、 / 全角空白 改行 )でセルのテキストを分割する */
export function splitEntries(s: string): string[] {
  return stripDatePrefixes(s)
    .split(/[,、/　\r\n]+/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

const TIME_RANGE_RE =
  /^([0-9]{1,2})\s*[:：.]\s*([0-9]{2})\s*(?:[~〜\-–ー]|から)\s*([0-9]{1,2})\s*[:：.]\s*([0-9]{2})$/;

/** "10:00~10:20" のような1つの時刻レンジ文字列を解析する。不正な形式は null */
export function parseTimeRangeToken(raw: string): AvailabilityRange | null {
  const normalized = normalizeDigits(raw.trim());
  const m = TIME_RANGE_RE.exec(normalized);
  if (!m) return null;
  const startHour = Number(m[1]);
  const startMinute = Number(m[2]);
  const endHour = Number(m[3]);
  const endMinute = Number(m[4]);
  if (startMinute > 59 || endMinute > 59) return null;
  const start = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
  const end = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  if (start >= end) return null;
  return { start, end };
}

export interface AvailabilityParseResult {
  ranges: AvailabilityRange[];
  /** 時刻レンジとして解析できなかった断片(赤くハイライトして手動修正させる対象) */
  unparsedTokens: string[];
}

/** ロング形式のセル(複数の時刻レンジがまとまったテキスト)を解析する */
export function parseAvailabilityCell(cellText: string): AvailabilityParseResult {
  const tokens = splitEntries(cellText);
  const ranges: AvailabilityRange[] = [];
  const unparsedTokens: string[] = [];
  for (const token of tokens) {
    const range = parseTimeRangeToken(token);
    if (range) ranges.push(range);
    else unparsedTokens.push(token);
  }
  return { ranges, unparsedTokens };
}

/** セルのテキストに時刻レンジが含まれているか(列の役割推定に使う軽量判定) */
export function cellLooksLikeTimeRange(cellText: string): boolean {
  return splitEntries(cellText).some((t) => parseTimeRangeToken(t) !== null);
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
