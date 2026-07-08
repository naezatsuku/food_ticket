import type { NumberingSettings } from "./types";

/** 番号を「No.0001」の形式に整形する。桁あふれはそのまま全桁表示する */
export function formatTicketNumber(numbering: NumberingSettings, n: number): string {
  const abs = Math.max(0, Math.trunc(n));
  return numbering.prefix + String(abs).padStart(numbering.digits, "0");
}

/** 範囲内の枚数(start > end なら 0) */
export function countInRange(start: number, end: number): number {
  if (end < start) return 0;
  return end - start + 1;
}

/**
 * 番号範囲を検証し、エラーメッセージ(日本語)を返す。問題なければ null。
 */
export function validateRange(start: number, end: number, digits: number): string | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return "開始番号・終了番号は整数で指定してください。";
  }
  if (start < 1) {
    return "開始番号は 1 以上を指定してください。";
  }
  if (end < start) {
    return `番号範囲が逆転しています(開始 ${start} > 終了 ${end})。終了番号は開始番号以上にしてください。`;
  }
  const max = 10 ** digits - 1;
  if (end > max) {
    return `終了番号 ${end} が ${digits} 桁の上限(${max})を超えています。桁数を増やすか範囲を見直してください。`;
  }
  return null;
}

/**
 * sheetIndex(0始まり)のシートに載せる番号の配列を返す。
 * 最終シートは範囲の残り枚数のみ(空きセルは印字しない)。
 */
export function numbersForSheet(
  start: number,
  end: number,
  perSheet: number,
  sheetIndex: number
): number[] {
  const first = start + sheetIndex * perSheet;
  if (first > end) return [];
  const last = Math.min(end, first + perSheet - 1);
  const out: number[] = [];
  for (let n = first; n <= last; n++) out.push(n);
  return out;
}
