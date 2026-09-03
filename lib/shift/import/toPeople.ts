import { isPositiveMark, parseAvailabilityCell, parseDateText } from "./text";
import { formatDateShort } from "../slots";
import { createPerson } from "../types";
import type { ParsedGrid } from "./parseSource";
import type { ColumnRole } from "./detect";
import type { AvailabilityRange, Person, TimeSlot } from "../types";

export interface PersonDraft {
  /** grid上の元の行番号(確認画面でのハイライトに使う) */
  rowIndex: number;
  name: string;
  available: AvailabilityRange[];
  maxSlots: number | null;
  /** この行に関する警告(解析できなかった断片、対象日が特定できない、枠に存在しない時刻など) */
  issues: string[];
}

/** 隣接する範囲を1つに結合する(同じ日付内でのみ結合。例: 10:00〜10:20 と 10:20〜10:40 → 10:00〜10:40) */
export function mergeAdjacentRanges(ranges: AvailabilityRange[]): AvailabilityRange[] {
  const sorted = [...ranges].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  );
  const merged: AvailabilityRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.date === r.date && last.end === r.start) {
      last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * "9/13" のような日付テキストを、設定済みの枠の日付("YYYY-MM-DD")の中から解決する。
 * - 年が明記されていればそのまま採用する
 * - 年が無ければ、月日が一致する設定済みの日付を探す。無ければ設定済みの日付の年(無ければ西暦の先頭を借用)で仮決定する
 * - 日付テキスト自体が無ければ、設定済みの日付が1つだけの場合に限りそこへ割り当てる
 * - どうしても決められない場合は空文字を返す(呼び出し側で警告し、availabilityには含めない)
 */
export function resolveDate(dateText: string | null, configuredDates: string[]): string {
  const uniqueDates = Array.from(new Set(configuredDates)).sort();

  if (dateText === null) {
    return uniqueDates.length === 1 ? uniqueDates[0] : "";
  }

  const parsed = parseDateText(dateText);
  if (!parsed) return "";

  if (parsed.year !== null) {
    return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
  }

  const match = uniqueDates.find((d) => {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d);
    return m !== null && Number(m[1]) === parsed.month && Number(m[2]) === parsed.day;
  });
  if (match) return match;

  const fallbackYear = uniqueDates.length > 0 ? Number(uniqueDates[0].slice(0, 4)) : new Date().getFullYear();
  return `${String(fallbackYear).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
}

/** 指定した範囲の日付・開始・終了が、設定済みの枠と一致しているか警告を返す */
export function findSlotAlignmentWarning(range: AvailabilityRange, slots: TimeSlot[]): string | null {
  if (slots.length === 0) return null;
  const sameDateSlots = slots.filter((s) => s.date === range.date);
  if (sameDateSlots.length === 0) {
    return `${formatDateShort(range.date)} は枠が設定されている対象日にありません。`;
  }
  const starts = new Set(sameDateSlots.map((s) => s.start));
  const ends = new Set(sameDateSlots.map((s) => s.end));
  if (!starts.has(range.start)) return `${formatDateShort(range.date)} ${range.start}〜 は枠にありません。`;
  if (!ends.has(range.end)) return `${formatDateShort(range.date)} 〜${range.end} は枠にありません。`;
  return null;
}

function issuesForResolvedRanges(ranges: AvailabilityRange[], slots: TimeSlot[]): string[] {
  const issues: string[] = [];
  for (const r of ranges) {
    const warning = findSlotAlignmentWarning(r, slots);
    if (warning) issues.push(warning);
  }
  return issues;
}

/** ロング形式のグリッドを PersonDraft[] に変換する */
export function buildPeopleFromLongFormat(
  grid: ParsedGrid,
  hasHeaderRow: boolean,
  columnRoles: ColumnRole[],
  slots: TimeSlot[],
  /** 指定すると、セルに日付が無く(もしくは含まれていても)全ての時刻レンジをこの日付として取り込む */
  forcedDate?: string
): PersonDraft[] {
  const nameCol = columnRoles.indexOf("name");
  const timeCols = columnRoles.reduce<number[]>((acc, role, i) => {
    if (role === "timeRange") acc.push(i);
    return acc;
  }, []);
  const maxSlotsCol = columnRoles.indexOf("maxSlots");
  const configuredDates = slots.map((s) => s.date);

  const startRow = hasHeaderRow ? 1 : 0;
  const drafts: PersonDraft[] = [];

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r];
    if (row.every((c) => c.trim() === "")) continue;

    const name = nameCol >= 0 ? (row[nameCol] ?? "").trim() : "";
    const issues: string[] = [];
    if (name.trim() === "") issues.push("氏名が空欄です。");

    const resolved: AvailabilityRange[] = [];
    for (const c of timeCols) {
      const parsed = parseAvailabilityCell(row[c] ?? "");
      for (const token of parsed.unparsedTokens) {
        issues.push(`「${token}」を時刻レンジとして解析できませんでした。`);
      }
      for (const rr of parsed.ranges) {
        const date = forcedDate || resolveDate(rr.dateText, configuredDates);
        if (date === "") {
          issues.push(
            `「${rr.start}〜${rr.end}」の対象日が特定できません(枠設定タブで対象日を確認するか、セルに日付を含めてください)。`
          );
          continue;
        }
        resolved.push({ date, start: rr.start, end: rr.end });
      }
    }
    const merged = mergeAdjacentRanges(resolved);
    issues.push(...issuesForResolvedRanges(merged, slots));

    let maxSlots: number | null = null;
    if (maxSlotsCol >= 0) {
      const raw = (row[maxSlotsCol] ?? "").trim();
      const n = Number(raw);
      maxSlots = raw !== "" && Number.isFinite(n) ? Math.trunc(n) : null;
    }

    drafts.push({ rowIndex: r, name, available: merged, maxSlots, issues });
  }

  return drafts;
}

export interface WideTimeColumn {
  columnIndex: number;
  range: AvailabilityRange;
}

/**
 * ワイド形式のグリッドを PersonDraft[] に変換する。
 * 各時刻列の範囲(日付込み)は呼び出し側(確認画面でヘッダから推定・手動修正した結果)から受け取る。
 */
export function buildPeopleFromWideFormat(
  grid: ParsedGrid,
  nameColumnIndex: number,
  timeColumns: WideTimeColumn[],
  slots: TimeSlot[]
): PersonDraft[] {
  const drafts: PersonDraft[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (row.every((c) => c.trim() === "")) continue;

    const name = (row[nameColumnIndex] ?? "").trim();
    const ranges: AvailabilityRange[] = [];
    for (const { columnIndex, range } of timeColumns) {
      if (isPositiveMark(row[columnIndex] ?? "")) ranges.push(range);
    }
    const merged = mergeAdjacentRanges(ranges);

    const issues: string[] = [];
    if (name.trim() === "") issues.push("氏名が空欄です。");
    issues.push(...issuesForResolvedRanges(merged, slots));

    drafts.push({ rowIndex: r, name, available: merged, maxSlots: null, issues });
  }

  return drafts;
}

/**
 * 取り込んだ内容(drafts)を既存の名簿(existingPeople)とマージする。
 * 日ごとに分けて何度も取り込む運用を想定し、氏名が一致する人は「取り込んだ日付の希望」だけを
 * 上書きし、それ以外の日付の希望はそのまま残す(例: 9/12分を取り込んだ後、同じ人の9/13分を
 * 別途取り込んでも、9/12の希望は消えず両日分がまとまる)。
 * - 名簿に無い氏名は新規メンバーとして追加する
 * - 今回のdraftsに含まれない既存メンバーはそのまま変更しない(IDも維持されるので割当も保持される)
 * - 上限コマ数(maxSlots)は、今回の取り込みで指定があれば上書き、無ければ既存の値を維持する
 */
export function mergePeopleByName(existingPeople: Person[], drafts: PersonDraft[]): Person[] {
  const people = existingPeople.map((p) => ({ ...p, available: [...p.available] }));
  const indexByName = new Map(people.map((p, i) => [p.name.trim(), i]));

  for (const d of drafts) {
    const name = d.name.trim();
    if (name === "") continue;

    const touchedDates = new Set(d.available.map((r) => r.date));
    const existingIndex = indexByName.get(name);

    if (existingIndex === undefined) {
      indexByName.set(name, people.length);
      people.push(createPerson({ name, available: d.available, maxSlots: d.maxSlots }));
      continue;
    }

    const existing = people[existingIndex];
    const keptAvailable = existing.available.filter((r) => !touchedDates.has(r.date));
    people[existingIndex] = {
      ...existing,
      available: mergeAdjacentRanges([...keptAvailable, ...d.available]),
      maxSlots: d.maxSlots !== null ? d.maxSlots : existing.maxSlots,
    };
  }

  return people;
}
