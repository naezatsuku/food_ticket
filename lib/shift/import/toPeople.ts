import { isPositiveMark, parseAvailabilityCell } from "./text";
import type { ParsedGrid } from "./parseSource";
import type { ColumnRole } from "./detect";
import type { AvailabilityRange, TimeSlot } from "../types";

export interface PersonDraft {
  /** grid上の元の行番号(確認画面でのハイライトに使う) */
  rowIndex: number;
  name: string;
  available: AvailabilityRange[];
  maxSlots: number | null;
  /** この行に関する警告(解析できなかった断片、枠に存在しない時刻など) */
  issues: string[];
}

/** 隣接する範囲を1つに結合する(例: 10:00〜10:20 と 10:20〜10:40 → 10:00〜10:40) */
export function mergeAdjacentRanges(ranges: AvailabilityRange[]): AvailabilityRange[] {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const merged: AvailabilityRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.end === r.start) {
      last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** 指定した範囲の開始・終了が、設定済みの枠の境界と一致しているか警告を返す */
export function findSlotAlignmentWarning(range: AvailabilityRange, slots: TimeSlot[]): string | null {
  if (slots.length === 0) return null;
  const starts = new Set(slots.map((s) => s.start));
  const ends = new Set(slots.map((s) => s.end));
  if (!starts.has(range.start)) return `${range.start}〜 は枠にありません。`;
  if (!ends.has(range.end)) return `〜${range.end} は枠にありません。`;
  return null;
}

function buildIssues(
  name: string,
  ranges: AvailabilityRange[],
  unparsedTokens: string[],
  slots: TimeSlot[]
): string[] {
  const issues: string[] = [];
  if (name.trim() === "") issues.push("氏名が空欄です。");
  for (const token of unparsedTokens) {
    issues.push(`「${token}」を時刻レンジとして解析できませんでした。`);
  }
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
  slots: TimeSlot[]
): PersonDraft[] {
  const nameCol = columnRoles.indexOf("name");
  const timeCols = columnRoles.reduce<number[]>((acc, role, i) => {
    if (role === "timeRange") acc.push(i);
    return acc;
  }, []);
  const maxSlotsCol = columnRoles.indexOf("maxSlots");

  const startRow = hasHeaderRow ? 1 : 0;
  const drafts: PersonDraft[] = [];

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r];
    if (row.every((c) => c.trim() === "")) continue;

    const name = nameCol >= 0 ? (row[nameCol] ?? "").trim() : "";
    const ranges: AvailabilityRange[] = [];
    const unparsedTokens: string[] = [];
    for (const c of timeCols) {
      const parsed = parseAvailabilityCell(row[c] ?? "");
      ranges.push(...parsed.ranges);
      unparsedTokens.push(...parsed.unparsedTokens);
    }
    const merged = mergeAdjacentRanges(ranges);

    let maxSlots: number | null = null;
    if (maxSlotsCol >= 0) {
      const raw = (row[maxSlotsCol] ?? "").trim();
      const n = Number(raw);
      maxSlots = raw !== "" && Number.isFinite(n) ? Math.trunc(n) : null;
    }

    drafts.push({
      rowIndex: r,
      name,
      available: merged,
      maxSlots,
      issues: buildIssues(name, merged, unparsedTokens, slots),
    });
  }

  return drafts;
}

export interface WideTimeColumn {
  columnIndex: number;
  range: AvailabilityRange;
}

/**
 * ワイド形式のグリッドを PersonDraft[] に変換する。
 * 各時刻列の範囲は呼び出し側(確認画面でヘッダから推定・手動修正した結果)から受け取る。
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

    drafts.push({
      rowIndex: r,
      name,
      available: merged,
      maxSlots: null,
      issues: buildIssues(name, merged, [], slots),
    });
  }

  return drafts;
}
