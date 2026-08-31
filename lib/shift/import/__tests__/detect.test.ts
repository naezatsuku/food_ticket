import { describe, expect, it } from "vitest";
import {
  detectFormat,
  guessHasHeaderRow,
  inferLongFormatColumns,
  inferWideFormatColumns,
} from "../detect";

describe("guessHasHeaderRow", () => {
  it("ヘッダ行に時刻レンジが無く、本体にある場合はヘッダありと判定する", () => {
    const grid = [
      ["氏名", "時間帯"],
      ["山田太郎", "10:00-10:20"],
    ];
    expect(guessHasHeaderRow(grid)).toBe(true);
  });
  it("全行が同じ形なら(判定材料が無ければ)ヘッダなしと判定する", () => {
    const grid = [
      ["山田太郎", "10:00-10:20"],
      ["鈴木花子", "11:00-11:20"],
    ];
    expect(guessHasHeaderRow(grid)).toBe(false);
  });
  it("1行しかない場合はヘッダなし", () => {
    expect(guessHasHeaderRow([["山田太郎", "10:00-10:20"]])).toBe(false);
  });
  it("ヘッダ行自体が時刻レンジの並び(ワイド形式)でもヘッダありと判定する", () => {
    const grid = [
      ["氏名", "09:00-09:20", "09:20-09:40"],
      ["山田太郎", "○", ""],
    ];
    expect(guessHasHeaderRow(grid)).toBe(true);
  });
  it("1行目が時刻レンジ列を複数持つ実データ行の場合はヘッダと誤判定しない(日付跨ぎ対応)", () => {
    // 「氏名 + 日付ごとの時刻レンジ列」がロング形式で複数人分並ぶケース。
    // 1行目にも時刻レンジが2つ以上あるが、ワイド形式のヘッダ(時刻レンジが列名)とは異なり、
    // 2行目以降の同じ列にも実際の時刻レンジ値が入っているので、1行目もデータ行として扱うべき。
    const grid = [
      ["浅見 翔太", "9/13 10:00~11:40", "9/14 11:40~13:20"],
      ["鈴木 花子", "9/13 09:00~09:40", "9/14 09:00~09:40"],
    ];
    expect(guessHasHeaderRow(grid)).toBe(false);
  });
});

describe("detectFormat", () => {
  it("ヘッダに時刻レンジが2個以上並べばワイド形式", () => {
    const grid = [
      ["氏名", "10:00-10:20", "10:20-10:40"],
      ["山田太郎", "○", ""],
    ];
    expect(detectFormat(grid, true)).toBe("wide");
  });
  it("時刻レンジが1個以下ならロング形式", () => {
    const grid = [
      ["氏名", "時間帯"],
      ["山田太郎", "10:00-10:20"],
    ];
    expect(detectFormat(grid, true)).toBe("long");
  });
  it("ヘッダなしなら常にロング形式", () => {
    const grid = [["山田太郎", "10:00-10:20"]];
    expect(detectFormat(grid, false)).toBe("long");
  });
});

describe("inferLongFormatColumns", () => {
  it("氏名列・時刻列・上限コマ数列を推定する", () => {
    const grid = [
      ["氏名", "時間帯", "上限コマ数"],
      ["山田太郎", "10:00-10:20, 11:00-11:20", "3"],
      ["鈴木花子", "10:20-10:40", "2"],
    ];
    const { columnRoles } = inferLongFormatColumns(grid, true);
    expect(columnRoles).toEqual(["name", "timeRange", "maxSlots"]);
  });
  it("見出しが無くても列の内容から推定する", () => {
    const grid = [
      ["山田太郎", "10:00-10:20"],
      ["鈴木花子", "10:20-10:40"],
    ];
    const { columnRoles } = inferLongFormatColumns(grid, false);
    expect(columnRoles).toEqual(["name", "timeRange"]);
  });
});

describe("inferWideFormatColumns", () => {
  it("時刻レンジ列と氏名列を推定する", () => {
    const grid = [
      ["氏名", "10:00-10:20", "10:20-10:40"],
      ["山田太郎", "○", ""],
      ["鈴木花子", "", "○"],
    ];
    const { nameColumnIndex, timeColumnIndexes } = inferWideFormatColumns(grid);
    expect(nameColumnIndex).toBe(0);
    expect(timeColumnIndexes).toEqual([1, 2]);
  });
});
