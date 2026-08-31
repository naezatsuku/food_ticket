import { describe, expect, it } from "vitest";
import {
  formatDateShort,
  formatMinutesToTime,
  generateSlots,
  isValidDate,
  parseTimeToMinutes,
  validateSlotGeneration,
} from "../slots";

const DATE = "2026-09-13";

describe("parseTimeToMinutes", () => {
  it("正常な時刻を分に変換する", () => {
    expect(parseTimeToMinutes("10:00")).toBe(600);
    expect(parseTimeToMinutes("09:05")).toBe(545);
    expect(parseTimeToMinutes("0:00")).toBe(0);
  });
  it("不正な形式は null", () => {
    expect(parseTimeToMinutes("abc")).toBeNull();
    expect(parseTimeToMinutes("10:60")).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });
});

describe("formatMinutesToTime", () => {
  it("分をゼロ埋めの時刻文字列に変換する", () => {
    expect(formatMinutesToTime(600)).toBe("10:00");
    expect(formatMinutesToTime(545)).toBe("09:05");
    expect(formatMinutesToTime(0)).toBe("00:00");
  });
});

describe("isValidDate", () => {
  it("実在するカレンダー上の日付は true", () => {
    expect(isValidDate("2026-09-13")).toBe(true);
  });
  it("存在しない日付(2月30日等)は false", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
  });
  it("形式が不正なら false", () => {
    expect(isValidDate("2026/9/13")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("formatDateShort", () => {
  it("YYYY-MM-DD を M/D に変換する(年は表示しない)", () => {
    expect(formatDateShort("2026-09-13")).toBe("9/13");
  });
  it("形式が不正な値はそのまま返す", () => {
    expect(formatDateShort("不正")).toBe("不正");
  });
});

describe("validateSlotGeneration", () => {
  it("正常な設定はエラーなし", () => {
    expect(
      validateSlotGeneration({ date: DATE, start: "09:00", end: "17:00", intervalMinutes: 20, breaks: [] })
    ).toEqual([]);
  });
  it("対象日が未設定はエラー", () => {
    const errors = validateSlotGeneration({
      date: "",
      start: "09:00",
      end: "17:00",
      intervalMinutes: 20,
      breaks: [],
    });
    expect(errors).toContain("対象日を選択してください。");
  });
  it("終了が開始より前はエラー", () => {
    const errors = validateSlotGeneration({
      date: DATE,
      start: "17:00",
      end: "09:00",
      intervalMinutes: 20,
      breaks: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
  it("コマ長が0以下はエラー", () => {
    const errors = validateSlotGeneration({
      date: DATE,
      start: "09:00",
      end: "17:00",
      intervalMinutes: 0,
      breaks: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
  it("休憩の終了が開始より前はエラー", () => {
    const errors = validateSlotGeneration({
      date: DATE,
      start: "09:00",
      end: "17:00",
      intervalMinutes: 20,
      breaks: [{ start: "13:00", end: "12:00" }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("generateSlots", () => {
  it("開始〜終了を1コマの長さで分割する", () => {
    const slots = generateSlots({ date: DATE, start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] });
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      ["09:00", "09:20"],
      ["09:20", "09:40"],
      ["09:40", "10:00"],
    ]);
  });
  it("生成される枠には指定した対象日が設定される", () => {
    const slots = generateSlots({ date: DATE, start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] });
    expect(slots.every((s) => s.date === DATE)).toBe(true);
  });
  it("端数は切り捨てる(最後の不完全なコマは作らない)", () => {
    const slots = generateSlots({ date: DATE, start: "09:00", end: "09:50", intervalMinutes: 20, breaks: [] });
    expect(slots).toHaveLength(2);
  });
  it("休憩時間と重なるコマを除外する", () => {
    const slots = generateSlots({
      date: DATE,
      start: "09:00",
      end: "11:00",
      intervalMinutes: 30,
      breaks: [{ start: "10:00", end: "10:30" }],
    });
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      ["09:00", "09:30"],
      ["09:30", "10:00"],
      ["10:30", "11:00"],
    ]);
  });
  it("既定の必要人数を設定できる", () => {
    const slots = generateSlots(
      { date: DATE, start: "09:00", end: "09:20", intervalMinutes: 20, breaks: [] },
      3
    );
    expect(slots[0].capacity).toBe(3);
  });
  it("不正な設定では空配列を返す", () => {
    expect(
      generateSlots({ date: DATE, start: "17:00", end: "09:00", intervalMinutes: 20, breaks: [] })
    ).toEqual([]);
  });
  it("対象日が未設定でも空配列を返す", () => {
    expect(
      generateSlots({ date: "", start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] })
    ).toEqual([]);
  });
  it("生成される各枠のIDは一意", () => {
    const slots = generateSlots({ date: DATE, start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] });
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });
});
