import * as XLSX from "xlsx";
import type { ParsedGrid } from "./parseSource";

export interface ParsedWorkbook {
  sheetNames: string[];
  gridForSheet(name: string): ParsedGrid;
}

/** .xlsx / .xls / .csv ファイルを読み込み、シートごとに2次元配列へ変換する */
export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  return {
    sheetNames: workbook.SheetNames,
    gridForSheet(name: string): ParsedGrid {
      const sheet = workbook.Sheets[name];
      if (!sheet) return [];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
      });
      const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
      return rows.map((r) => Array.from({ length: maxCols }, (_, i) => String(r[i] ?? "").trim()));
    },
  };
}
