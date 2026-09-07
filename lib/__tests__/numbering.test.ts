import { describe, expect, it } from "vitest";
import { countInRange, formatTicketNumber, numbersForSheet, validateRange } from "../numbering";

describe("formatTicketNumber", () => {
  it("4桁ゼロ埋め", () => {
    expect(formatTicketNumber({ prefix: "No.", digits: 4, orientation: "horizontal" }, 1)).toBe("No.0001");
  });
  it("3桁・5桁", () => {
    expect(formatTicketNumber({ prefix: "No.", digits: 3, orientation: "horizontal" }, 42)).toBe("No.042");
    expect(formatTicketNumber({ prefix: "No.", digits: 5, orientation: "horizontal" }, 42)).toBe("No.00042");
  });
  it("プレフィックス自由入力", () => {
    expect(formatTicketNumber({ prefix: "#", digits: 4, orientation: "horizontal" }, 7)).toBe("#0007");
    expect(formatTicketNumber({ prefix: "", digits: 3, orientation: "horizontal" }, 7)).toBe("007");
  });
  it("桁あふれは切り捨てず全桁表示", () => {
    expect(formatTicketNumber({ prefix: "No.", digits: 3, orientation: "horizontal" }, 1234)).toBe("No.1234");
  });
});

describe("countInRange", () => {
  it("1〜40は40枚", () => {
    expect(countInRange(1, 40)).toBe(40);
  });
  it("同一番号は1枚", () => {
    expect(countInRange(5, 5)).toBe(1);
  });
  it("逆転は0枚", () => {
    expect(countInRange(10, 5)).toBe(0);
  });
});

describe("validateRange", () => {
  it("正常範囲はnull", () => {
    expect(validateRange(1, 40, 4)).toBeNull();
  });
  it("逆転はエラー", () => {
    expect(validateRange(10, 5, 4)).toContain("逆転");
  });
  it("開始0以下はエラー", () => {
    expect(validateRange(0, 5, 4)).toContain("1 以上");
  });
  it("桁数上限超えはエラー", () => {
    expect(validateRange(1, 1000, 3)).toContain("上限");
    expect(validateRange(1, 999, 3)).toBeNull();
  });
  it("非整数はエラー", () => {
    expect(validateRange(1.5, 10, 4)).toContain("整数");
  });
});

describe("numbersForSheet", () => {
  it("1シート目は先頭からperSheet枚", () => {
    expect(numbersForSheet(1, 40, 10, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it("最終シートは残りのみ", () => {
    expect(numbersForSheet(1, 25, 10, 2)).toEqual([21, 22, 23, 24, 25]);
  });
  it("範囲外のシートは空", () => {
    expect(numbersForSheet(1, 10, 10, 1)).toEqual([]);
  });
  it("開始番号が1以外でも正しい", () => {
    expect(numbersForSheet(41, 60, 10, 1)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  });
});
