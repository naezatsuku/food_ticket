import { describe, expect, it } from "vitest";
import {
  cellLooksLikeTimeRange,
  isPositiveMark,
  normalizeDigits,
  parseAvailabilityCell,
  parseTimeRangeToken,
  splitEntries,
  stripDatePrefixes,
} from "../text";

describe("normalizeDigits", () => {
  it("全角数字を半角に変換する", () => {
    expect(normalizeDigits("１０:００〜１２:００")).toBe("10:00〜12:00");
  });
  it("半角はそのまま", () => {
    expect(normalizeDigits("10:00")).toBe("10:00");
  });
});

describe("splitEntries", () => {
  it("カンマ・読点・スラッシュ・全角空白・改行で分割する", () => {
    expect(splitEntries("10:00-10:20,10:20-10:40、10:40-11:00/11:00-11:20　11:20-11:40\n11:40-12:00"))
      .toHaveLength(6);
  });
  it("空白のみの断片は除外する", () => {
    expect(splitEntries("a,, ,b")).toEqual(["a", "b"]);
  });
  it("日付+時刻('9/13 10:00~11:40')の日付部分が誤って区切り文字扱いされない", () => {
    expect(splitEntries("9/13 10:00~11:40")).toEqual(["10:00~11:40"]);
  });
  it("日付付きの複数レンジも正しく分割する", () => {
    expect(splitEntries("9/13 10:00-10:20, 9/14 13:00-14:00")).toEqual([
      "10:00-10:20",
      "13:00-14:00",
    ]);
  });
});

describe("stripDatePrefixes", () => {
  it("「M/D 時刻」の日付部分を取り除く", () => {
    expect(stripDatePrefixes("9/13 10:00~11:40")).toBe("10:00~11:40");
  });
  it("曜日付き「M/D(曜) 時刻」にも対応する", () => {
    expect(stripDatePrefixes("9/13(土) 10:00-11:40")).toBe("10:00-11:40");
  });
  it("年/月/日形式にも対応する", () => {
    expect(stripDatePrefixes("2026/9/13 10:00-11:40")).toBe("10:00-11:40");
  });
  it("「M月D日」形式にも対応する", () => {
    expect(stripDatePrefixes("9月13日 10:00-11:40")).toBe("10:00-11:40");
  });
  it("時刻が続かない「9/13」単体は取り除かない(誤爆防止)", () => {
    expect(stripDatePrefixes("9/13")).toBe("9/13");
  });
  it("日付が無い通常の時刻レンジには影響しない", () => {
    expect(stripDatePrefixes("10:00-10:20, 11:20-11:40")).toBe("10:00-10:20, 11:20-11:40");
  });
  it("「/」区切りの複数レンジ('HH:MM/HH:MM')を日付と誤認しない", () => {
    expect(stripDatePrefixes("10:00-10:20/10:20-10:40")).toBe("10:00-10:20/10:20-10:40");
  });
});

describe("parseTimeRangeToken", () => {
  it("コロン区切りの標準形式を解析する", () => {
    expect(parseTimeRangeToken("10:00-10:20")).toEqual({ start: "10:00", end: "10:20" });
  });
  it("全角コロン・波ダッシュに対応する", () => {
    expect(parseTimeRangeToken("１０：００〜１０：２０")).toEqual({ start: "10:00", end: "10:20" });
  });
  it("「から」区切りに対応する", () => {
    expect(parseTimeRangeToken("10:00から10:20")).toEqual({ start: "10:00", end: "10:20" });
  });
  it("ピリオド区切りの時刻に対応する", () => {
    expect(parseTimeRangeToken("10.00-10.20")).toEqual({ start: "10:00", end: "10:20" });
  });
  it("開始が終了以降なら null", () => {
    expect(parseTimeRangeToken("10:20-10:00")).toBeNull();
  });
  it("分が60以上なら null", () => {
    expect(parseTimeRangeToken("10:60-11:00")).toBeNull();
  });
  it("時刻レンジでない文字列は null", () => {
    expect(parseTimeRangeToken("よろしくお願いします")).toBeNull();
  });
});

describe("parseAvailabilityCell", () => {
  it("複数の時刻レンジを解析し、解析できない断片も返す", () => {
    const result = parseAvailabilityCell("10:00-10:20, 11:20~11:40, おかしい値");
    expect(result.ranges).toEqual([
      { start: "10:00", end: "10:20" },
      { start: "11:20", end: "11:40" },
    ]);
    expect(result.unparsedTokens).toEqual(["おかしい値"]);
  });

  it("日付付きの時刻レンジ('9/13 10:00~11:40')を正しく解析する", () => {
    const result = parseAvailabilityCell("9/13 10:00~11:40");
    expect(result.ranges).toEqual([{ start: "10:00", end: "11:40" }]);
    expect(result.unparsedTokens).toEqual([]);
  });
});

describe("cellLooksLikeTimeRange", () => {
  it("時刻レンジを含むセルは true", () => {
    expect(cellLooksLikeTimeRange("10:00-10:20")).toBe(true);
  });
  it("時刻レンジを含まないセルは false", () => {
    expect(cellLooksLikeTimeRange("山田太郎")).toBe(false);
  });
});

describe("isPositiveMark", () => {
  it("○や1などの記号は入れる扱い", () => {
    expect(isPositiveMark("○")).toBe(true);
    expect(isPositiveMark("1")).toBe(true);
    expect(isPositiveMark("✓")).toBe(true);
  });
  it("空欄・×・0・-は入れない扱い", () => {
    expect(isPositiveMark("")).toBe(false);
    expect(isPositiveMark("×")).toBe(false);
    expect(isPositiveMark("0")).toBe(false);
    expect(isPositiveMark("-")).toBe(false);
  });
});
