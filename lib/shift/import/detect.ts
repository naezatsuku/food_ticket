import { cellLooksLikeTimeRange } from "./text";
import type { ParsedGrid } from "./parseSource";

export type ImportFormat = "long" | "wide";

/** 1行目だけデータ型が他行と異なるかを見てヘッダ行の有無を推定する */
export function guessHasHeaderRow(grid: ParsedGrid): boolean {
  if (grid.length < 2) return false;
  const header = grid[0];
  const body = grid.slice(1);
  const headerTimeRangeCols = header
    .map((c, i) => (cellLooksLikeTimeRange(c) ? i : -1))
    .filter((i) => i >= 0);
  const headerTimeRangeCount = headerTimeRangeCols.length;
  // ワイド形式はヘッダ行に時刻レンジが2個以上並ぶので、それだけでヘッダありと判定する。
  // ただし本体行の同じ列にも実際の時刻レンジが入っている場合は、
  // ワイド形式の見出し(時刻レンジそのものが列名)ではなく「1行=1人・時刻レンジ列が複数
  // (日付ごとの列など)」というロング形式のデータ行である可能性が高いので、ヘッダとは判定しない。
  if (headerTimeRangeCount >= 2) {
    const bodyAlsoHasTimeRangeInSameCols = headerTimeRangeCols.some((col) =>
      body.some((row) => cellLooksLikeTimeRange(row[col] ?? ""))
    );
    if (!bodyAlsoHasTimeRangeInSameCols) return true;
  }

  const bodyHasTimeRange = body.some((row) => row.some((c) => cellLooksLikeTimeRange(c)));
  // ヘッダ行自体には時刻レンジが無く、他の行にはある場合(ロング形式)はヘッダありと判定する
  if (headerTimeRangeCount === 0 && bodyHasTimeRange) return true;

  const isNumericCell = (c: string) => c.trim() !== "" && /^[0-9]+(\.[0-9]+)?$/.test(c.trim());
  const headerNumericRatio = ratio(header, isNumericCell);
  const bodyNumericRatio = ratio(body.flat(), isNumericCell);
  // ヘッダ行は数値が少なく、本体は数値が多い場合もヘッダありと判定する
  return headerNumericRatio < 0.2 && bodyNumericRatio > 0.5;
}

function ratio(cells: string[], predicate: (c: string) => boolean): number {
  const nonEmpty = cells.filter((c) => c.trim() !== "");
  if (nonEmpty.length === 0) return 0;
  return nonEmpty.filter(predicate).length / nonEmpty.length;
}

/** ヘッダ行の時刻レンジ列が2個以上並んでいればワイド形式と判定する */
export function detectFormat(grid: ParsedGrid, hasHeaderRow: boolean): ImportFormat {
  if (!hasHeaderRow || grid.length === 0) return "long";
  const header = grid[0];
  const timeHeaderCount = header.filter((c) => cellLooksLikeTimeRange(c)).length;
  return timeHeaderCount >= 2 ? "wide" : "long";
}

export type ColumnRole = "name" | "timeRange" | "maxSlots" | "ignore";

export interface LongFormatColumns {
  columnRoles: ColumnRole[];
}

const MAX_SLOTS_HEADER_RE = /上限|コマ|回数/;

/** ロング形式(1行=1人)の列の意味を推定する */
export function inferLongFormatColumns(grid: ParsedGrid, hasHeaderRow: boolean): LongFormatColumns {
  const bodyRows = hasHeaderRow ? grid.slice(1) : grid;
  const header = hasHeaderRow ? grid[0] : [];
  const colCount = grid.reduce((max, r) => Math.max(max, r.length), 0);

  const columnRoles: ColumnRole[] = new Array(colCount).fill("ignore");

  const isTimeColumn = (col: number) => {
    const cells = bodyRows.map((r) => r[col] ?? "").filter((c) => c.trim() !== "");
    if (cells.length === 0) return false;
    return cells.filter((c) => cellLooksLikeTimeRange(c)).length / cells.length >= 0.5;
  };
  const isNumericColumn = (col: number) => {
    const cells = bodyRows.map((r) => r[col] ?? "").filter((c) => c.trim() !== "");
    if (cells.length === 0) return false;
    return cells.every((c) => /^[0-9]+$/.test(c.trim()));
  };

  const timeColumns: number[] = [];
  for (let c = 0; c < colCount; c++) {
    if (isTimeColumn(c)) {
      columnRoles[c] = "timeRange";
      timeColumns.push(c);
    }
  }

  // 氏名列: 時刻列でなく、値がほぼ一意で、空欄が少なく、文字数が短い列を選ぶ
  let nameCol = -1;
  let bestScore = -Infinity;
  for (let c = 0; c < colCount; c++) {
    if (columnRoles[c] === "timeRange") continue;
    const cells = bodyRows.map((r) => (r[c] ?? "").trim());
    const nonEmpty = cells.filter((c2) => c2 !== "");
    if (nonEmpty.length === 0) continue;
    const blankRatio = 1 - nonEmpty.length / cells.length;
    const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    const numericPenalty = isNumericColumn(c) ? 1 : 0;
    const score = uniqueRatio - blankRatio - numericPenalty - avgLen / 100;
    if (score > bestScore) {
      bestScore = score;
      nameCol = c;
    }
  }
  if (nameCol >= 0) columnRoles[nameCol] = "name";

  // 上限コマ数列: 見出しに「上限」「コマ」「回数」を含む列を優先し、
  // なければ氏名・時刻列以外で値が小さい整数のみの列を採用する
  let maxSlotsCol = -1;
  if (hasHeaderRow) {
    maxSlotsCol = header.findIndex((h, c) => columnRoles[c] === "ignore" && MAX_SLOTS_HEADER_RE.test(h));
  }
  if (maxSlotsCol < 0) {
    maxSlotsCol = columnRoles.findIndex((role, c) => role === "ignore" && isNumericColumn(c));
  }
  if (maxSlotsCol >= 0) columnRoles[maxSlotsCol] = "maxSlots";

  return { columnRoles };
}

export interface WideFormatColumns {
  nameColumnIndex: number;
  /** ヘッダの時刻レンジ列(この列インデックスの見出しが時刻レンジ) */
  timeColumnIndexes: number[];
}

/** ワイド形式(ヘッダ=時刻レンジの並び)の列の意味を推定する */
export function inferWideFormatColumns(grid: ParsedGrid): WideFormatColumns {
  const header = grid[0] ?? [];
  const timeColumnIndexes: number[] = [];
  header.forEach((h, c) => {
    if (cellLooksLikeTimeRange(h)) timeColumnIndexes.push(c);
  });

  const bodyRows = grid.slice(1);
  let nameColumnIndex = -1;
  let bestScore = -Infinity;
  for (let c = 0; c < header.length; c++) {
    if (timeColumnIndexes.includes(c)) continue;
    const cells = bodyRows.map((r) => (r[c] ?? "").trim());
    const nonEmpty = cells.filter((c2) => c2 !== "");
    if (nonEmpty.length === 0) continue;
    const blankRatio = 1 - nonEmpty.length / cells.length;
    const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
    const score = uniqueRatio - blankRatio;
    if (score > bestScore) {
      bestScore = score;
      nameColumnIndex = c;
    }
  }
  if (nameColumnIndex < 0) {
    // 候補が無ければ、時刻列でない先頭の列を氏名列とみなす
    nameColumnIndex = header.findIndex((_, c) => !timeColumnIndexes.includes(c));
  }

  return { nameColumnIndex, timeColumnIndexes };
}
