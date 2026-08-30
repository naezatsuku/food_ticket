import { describe, expect, it } from "vitest";
import {
  formatMinutesToTime,
  generateSlots,
  parseTimeToMinutes,
  validateSlotGeneration,
} from "../slots";

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

describe("validateSlotGeneration", () => {
  it("正常な設定はエラーなし", () => {
    expect(
      validateSlotGeneration({ start: "09:00", end: "17:00", intervalMinutes: 20, breaks: [] })
    ).toEqual([]);
  });
  it("終了が開始より前はエラー", () => {
    const errors = validateSlotGeneration({
      start: "17:00",
      end: "09:00",
      intervalMinutes: 20,
      breaks: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
  it("コマ長が0以下はエラー", () => {
    const errors = validateSlotGeneration({
      start: "09:00",
      end: "17:00",
      intervalMinutes: 0,
      breaks: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
  it("休憩の終了が開始より前はエラー", () => {
    const errors = validateSlotGeneration({
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
    const slots = generateSlots({ start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] });
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      ["09:00", "09:20"],
      ["09:20", "09:40"],
      ["09:40", "10:00"],
    ]);
  });
  it("端数は切り捨てる(最後の不完全なコマは作らない)", () => {
    const slots = generateSlots({ start: "09:00", end: "09:50", intervalMinutes: 20, breaks: [] });
    expect(slots).toHaveLength(2);
  });
  it("休憩時間と重なるコマを除外する", () => {
    const slots = generateSlots({
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
      { start: "09:00", end: "09:20", intervalMinutes: 20, breaks: [] },
      3
    );
    expect(slots[0].capacity).toBe(3);
  });
  it("不正な設定では空配列を返す", () => {
    expect(
      generateSlots({ start: "17:00", end: "09:00", intervalMinutes: 20, breaks: [] })
    ).toEqual([]);
  });
  it("生成される各枠のIDは一意", () => {
    const slots = generateSlots({ start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] });
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
  });
});
