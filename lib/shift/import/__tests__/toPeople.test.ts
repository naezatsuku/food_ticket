import { describe, expect, it } from "vitest";
import {
  buildPeopleFromLongFormat,
  buildPeopleFromWideFormat,
  findSlotAlignmentWarning,
  mergeAdjacentRanges,
} from "../toPeople";
import type { TimeSlot } from "../../types";

const slots: TimeSlot[] = [
  { id: "s1", start: "09:00", end: "09:20", capacity: 1 },
  { id: "s2", start: "09:20", end: "09:40", capacity: 1 },
];

describe("mergeAdjacentRanges", () => {
  it("隣接する範囲を結合する", () => {
    expect(
      mergeAdjacentRanges([
        { start: "10:20", end: "10:40" },
        { start: "10:00", end: "10:20" },
      ])
    ).toEqual([{ start: "10:00", end: "10:40" }]);
  });
  it("離れた範囲は結合しない", () => {
    expect(
      mergeAdjacentRanges([
        { start: "10:00", end: "10:20" },
        { start: "11:00", end: "11:20" },
      ])
    ).toEqual([
      { start: "10:00", end: "10:20" },
      { start: "11:00", end: "11:20" },
    ]);
  });
});

describe("findSlotAlignmentWarning", () => {
  it("枠の境界と一致すれば警告なし", () => {
    expect(findSlotAlignmentWarning({ start: "09:00", end: "09:40" }, slots)).toBeNull();
  });
  it("開始時刻が枠の境界に無ければ警告", () => {
    expect(findSlotAlignmentWarning({ start: "09:05", end: "09:40" }, slots)).toContain("09:05");
  });
  it("枠が未設定なら警告しない", () => {
    expect(findSlotAlignmentWarning({ start: "09:05", end: "09:40" }, [])).toBeNull();
  });
});

describe("buildPeopleFromLongFormat", () => {
  it("氏名・時刻レンジ・上限コマ数を取り出す", () => {
    const grid = [
      ["氏名", "時間帯", "上限"],
      ["山田太郎", "09:00-09:20, 09:20-09:40", "2"],
    ];
    const drafts = buildPeopleFromLongFormat(grid, true, ["name", "timeRange", "maxSlots"], slots);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("山田太郎");
    expect(drafts[0].available).toEqual([{ start: "09:00", end: "09:40" }]);
    expect(drafts[0].maxSlots).toBe(2);
    expect(drafts[0].issues).toEqual([]);
  });
  it("空欄の氏名や解析できない断片を issues に記録する", () => {
    const grid = [
      ["氏名", "時間帯"],
      ["", "10:00-10:20"],
      ["鈴木花子", "よくわからない値"],
    ];
    const drafts = buildPeopleFromLongFormat(grid, true, ["name", "timeRange"], slots);
    expect(drafts[0].issues).toContain("氏名が空欄です。");
    expect(drafts[1].issues.some((i) => i.includes("よくわからない値"))).toBe(true);
  });
  it("完全に空の行はスキップする", () => {
    const grid = [
      ["氏名", "時間帯"],
      ["", ""],
      ["山田太郎", "09:00-09:20"],
    ];
    const drafts = buildPeopleFromLongFormat(grid, true, ["name", "timeRange"], slots);
    expect(drafts).toHaveLength(1);
  });
});

describe("buildPeopleFromWideFormat", () => {
  const timeColumns = [
    { columnIndex: 1, range: { start: "09:00", end: "09:20" } },
    { columnIndex: 2, range: { start: "09:20", end: "09:40" } },
  ];

  it("マークの付いた列を availability に変換する", () => {
    const grid = [
      ["氏名", "09:00-09:20", "09:20-09:40"],
      ["山田太郎", "○", ""],
      ["鈴木花子", "", "1"],
    ];
    const drafts = buildPeopleFromWideFormat(grid, 0, timeColumns, slots);
    expect(drafts[0].available).toEqual([{ start: "09:00", end: "09:20" }]);
    expect(drafts[1].available).toEqual([{ start: "09:20", end: "09:40" }]);
  });
  it("隣接する列のマークは結合される", () => {
    const grid = [
      ["氏名", "09:00-09:20", "09:20-09:40"],
      ["山田太郎", "○", "○"],
    ];
    const drafts = buildPeopleFromWideFormat(grid, 0, timeColumns, slots);
    expect(drafts[0].available).toEqual([{ start: "09:00", end: "09:40" }]);
  });
});
