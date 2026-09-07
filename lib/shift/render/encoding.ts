import Encoding from "encoding-japanese";

export type CsvEncoding = "utf8-bom" | "shift-jis";

const BOM = "﻿";

/** CSV文字列を指定エンコーディングの Blob に変換する(Excelでの文字化け対策) */
export function csvToBlob(text: string, encoding: CsvEncoding): Blob {
  if (encoding === "shift-jis") {
    const unicodeArray = Encoding.stringToCode(text);
    const sjisArray = Encoding.convert(unicodeArray, { to: "SJIS", from: "UNICODE" });
    return new Blob([new Uint8Array(sjisArray)], { type: "text/csv" });
  }
  return new Blob([BOM + text], { type: "text/csv;charset=utf-8" });
}
