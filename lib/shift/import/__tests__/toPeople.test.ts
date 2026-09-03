import { describe, expect, it } from "vitest";
import {
  buildPeopleFromLongFormat,
  buildPeopleFromWideFormat,
  findSlotAlignmentWarning,
  mergeAdjacentRanges,
  mergePeopleByName,
  resolveDate,
} from "../toPeople";
import { createPerson } from "../../types";
import type { Person, TimeSlot } from "../../types";

const DATE = "2026-09-13";

const slots: TimeSlot[] = [
  { id: "s1", date: DATE, start: "09:00", end: "09:20", capacity: 1 },
  { id: "s2", date: DATE, start: "09:20", end: "09:40", capacity: 1 },
];

describe("mergeAdjacentRanges", () => {
  it("隣接する範囲を結合する", () => {
    expect(
      mergeAdjacentRanges([
        { date: DATE, start: "10:20", end: "10:40" },
        { date: DATE, start: "10:00", end: "10:20" },
      ])
    ).toEqual([{ date: DATE, start: "10:00", end: "10:40" }]);
  });
  it("離れた範囲は結合しない", () => {
    expect(
      mergeAdjacentRanges([
        { date: DATE, start: "10:00", end: "10:20" },
        { date: DATE, start: "11:00", end: "11:20" },
      ])
    ).toEqual([
      { date: DATE, start: "10:00", end: "10:20" },
      { date: DATE, start: "11:00", end: "11:20" },
    ]);
  });
  it("時刻が隣接していても日付が異なれば結合しない(日付跨ぎ対応)", () => {
    expect(
      mergeAdjacentRanges([
        { date: "2026-09-12", start: "10:00", end: "10:20" },
        { date: "2026-09-13", start: "10:20", end: "10:40" },
      ])
    ).toEqual([
      { date: "2026-09-12", start: "10:00", end: "10:20" },
      { date: "2026-09-13", start: "10:20", end: "10:40" },
    ]);
  });
});

describe("resolveDate", () => {
  it("日付テキストが無く、対象日が1つだけならその日を採用する", () => {
    expect(resolveDate(null, [DATE])).toBe(DATE);
  });
  it("日付テキストが無く、対象日が複数あれば特定できない", () => {
    expect(resolveDate(null, [DATE, "2026-09-14"])).toBe("");
  });
  it("日付テキストが無く、対象日が無ければ特定できない", () => {
    expect(resolveDate(null, [])).toBe("");
  });
  it("年が明記されていればそのまま採用する", () => {
    expect(resolveDate("2026/9/13", [])).toBe("2026-09-13");
  });
  it("年が無ければ月日が一致する設定済みの日付を採用する", () => {
    expect(resolveDate("9/14", [DATE, "2026-09-14"])).toBe("2026-09-14");
  });
  it("月日が一致する設定済み日付が無ければ、設定済み日付の年を借用して仮決定する", () => {
    expect(resolveDate("9/20", [DATE])).toBe("2026-09-20");
  });
  it("解析できない日付テキストは特定できない", () => {
    expect(resolveDate("abc", [DATE])).toBe("");
  });
});

describe("findSlotAlignmentWarning", () => {
  it("枠の境界と一致すれば警告なし", () => {
    expect(findSlotAlignmentWarning({ date: DATE, start: "09:00", end: "09:40" }, slots)).toBeNull();
  });
  it("開始時刻が枠の境界に無ければ警告", () => {
    expect(findSlotAlignmentWarning({ date: DATE, start: "09:05", end: "09:40" }, slots)).toContain(
      "09:05"
    );
  });
  it("枠が未設定なら警告しない", () => {
    expect(findSlotAlignmentWarning({ date: DATE, start: "09:05", end: "09:40" }, [])).toBeNull();
  });
  it("その日付の枠が設定されていなければ警告する(日付跨ぎ対応)", () => {
    const warning = findSlotAlignmentWarning({ date: "2026-09-14", start: "09:00", end: "09:20" }, slots);
    expect(warning).toContain("9/14");
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
    expect(drafts[0].available).toEqual([{ date: DATE, start: "09:00", end: "09:40" }]);
    expect(drafts[0].maxSlots).toBe(2);
    expect(drafts[0].issues).toEqual([]);
  });
  it("セルに日付が含まれていればその日付を採用する", () => {
    const twoDaySlots: TimeSlot[] = [
      ...slots,
      { id: "s3", date: "2026-09-14", start: "09:00", end: "09:20", capacity: 1 },
    ];
    const grid = [
      ["氏名", "時間帯"],
      ["山田太郎", "9/14 09:00-09:20"],
    ];
    const drafts = buildPeopleFromLongFormat(grid, true, ["name", "timeRange"], twoDaySlots);
    expect(drafts[0].available).toEqual([{ date: "2026-09-14", start: "09:00", end: "09:20" }]);
  });
  it("対象日が複数あって日付を特定できない場合は issues に記録し availability に含めない", () => {
    const twoDaySlots: TimeSlot[] = [
      ...slots,
      { id: "s3", date: "2026-09-14", start: "09:00", end: "09:20", capacity: 1 },
    ];
    const grid = [
      ["氏名", "時間帯"],
      ["山田太郎", "09:00-09:20"],
    ];
    const drafts = buildPeopleFromLongFormat(grid, true, ["name", "timeRange"], twoDaySlots);
    expect(drafts[0].available).toEqual([]);
    expect(drafts[0].issues.some((i) => i.includes("対象日が特定できません"))).toBe(true);
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

  describe("forcedDate(対象日を指定して日付なしで取り込む)", () => {
    const twoDaySlots: TimeSlot[] = [
      ...slots,
      { id: "s3", date: "2026-09-14", start: "09:00", end: "09:20", capacity: 1 },
    ];

    it("対象日が複数あって本来なら特定できないケースでも、forcedDateがあれば解決できる", () => {
      const grid = [
        ["氏名", "時間帯"],
        ["山田太郎", "09:00-09:20"],
      ];
      const drafts = buildPeopleFromLongFormat(
        grid,
        true,
        ["name", "timeRange"],
        twoDaySlots,
        "2026-09-14"
      );
      expect(drafts[0].available).toEqual([{ date: "2026-09-14", start: "09:00", end: "09:20" }]);
      expect(drafts[0].issues).toEqual([]);
    });

    it("セルに日付が書かれていても、forcedDateが優先される", () => {
      const grid = [
        ["氏名", "時間帯"],
        ["山田太郎", "9/13 09:00-09:20"],
      ];
      const drafts = buildPeopleFromLongFormat(
        grid,
        true,
        ["name", "timeRange"],
        twoDaySlots,
        "2026-09-14"
      );
      expect(drafts[0].available).toEqual([{ date: "2026-09-14", start: "09:00", end: "09:20" }]);
    });
  });
});

describe("mergePeopleByName", () => {
  function draft(name: string, available: Person["available"], maxSlots: number | null = null) {
    return { rowIndex: 0, name, available, maxSlots, issues: [] };
  }

  it("名簿に無い氏名は新規メンバーとして追加する", () => {
    const result = mergePeopleByName([], [draft("山田太郎", [{ date: DATE, start: "09:00", end: "09:20" }])]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("山田太郎");
    expect(result[0].available).toEqual([{ date: DATE, start: "09:00", end: "09:20" }]);
  });

  it("同じ氏名の既存メンバーは、取り込んだ日付の希望だけを更新し、他の日付は残す", () => {
    const existing = createPerson({
      name: "山田太郎",
      available: [
        { date: "2026-09-12", start: "10:00", end: "11:00" },
        { date: DATE, start: "09:00", end: "10:00" },
      ],
    });
    const result = mergePeopleByName(
      [existing],
      [draft("山田太郎", [{ date: DATE, start: "13:00", end: "14:00" }])]
    );
    expect(result).toHaveLength(1);
    expect(result[0].available).toEqual([
      { date: "2026-09-12", start: "10:00", end: "11:00" },
      { date: DATE, start: "13:00", end: "14:00" },
    ]);
  });

  it("既存メンバーのIDは維持される(割当の継続性のため)", () => {
    const existing = createPerson({ name: "山田太郎", available: [] });
    const result = mergePeopleByName(
      [existing],
      [draft("山田太郎", [{ date: DATE, start: "09:00", end: "09:20" }])]
    );
    expect(result[0].id).toBe(existing.id);
  });

  it("今回の取り込みに含まれない既存メンバーはそのまま変更しない", () => {
    const untouched = createPerson({
      name: "鈴木花子",
      available: [{ date: DATE, start: "09:00", end: "09:20" }],
    });
    const result = mergePeopleByName([untouched], [draft("山田太郎", [{ date: DATE, start: "09:00", end: "09:20" }])]);
    expect(result).toContainEqual(untouched);
  });

  it("上限コマ数は今回の取り込みで指定があれば上書きし、無ければ既存の値を維持する", () => {
    const existing = createPerson({ name: "山田太郎", available: [], maxSlots: 3 });
    const result1 = mergePeopleByName([existing], [draft("山田太郎", [], null)]);
    expect(result1[0].maxSlots).toBe(3);

    const result2 = mergePeopleByName([existing], [draft("山田太郎", [], 5)]);
    expect(result2[0].maxSlots).toBe(5);
  });

  it("氏名が空欄のdraftは無視する", () => {
    const result = mergePeopleByName([], [draft("", [{ date: DATE, start: "09:00", end: "09:20" }])]);
    expect(result).toEqual([]);
  });
});

describe("buildPeopleFromWideFormat", () => {
  const timeColumns = [
    { columnIndex: 1, range: { date: DATE, start: "09:00", end: "09:20" } },
    { columnIndex: 2, range: { date: DATE, start: "09:20", end: "09:40" } },
  ];

  it("マークの付いた列を availability に変換する", () => {
    const grid = [
      ["氏名", "09:00-09:20", "09:20-09:40"],
      ["山田太郎", "○", ""],
      ["鈴木花子", "", "1"],
    ];
    const drafts = buildPeopleFromWideFormat(grid, 0, timeColumns, slots);
    expect(drafts[0].available).toEqual([{ date: DATE, start: "09:00", end: "09:20" }]);
    expect(drafts[1].available).toEqual([{ date: DATE, start: "09:20", end: "09:40" }]);
  });
  it("隣接する列のマークは結合される", () => {
    const grid = [
      ["氏名", "09:00-09:20", "09:20-09:40"],
      ["山田太郎", "○", "○"],
    ];
    const drafts = buildPeopleFromWideFormat(grid, 0, timeColumns, slots);
    expect(drafts[0].available).toEqual([{ date: DATE, start: "09:00", end: "09:40" }]);
  });
  it("列ごとに異なる日付が割り当てられていれば結合しない(日付跨ぎ対応)", () => {
    const crossDateColumns = [
      { columnIndex: 1, range: { date: "2026-09-12", start: "09:20", end: "09:40" } },
      { columnIndex: 2, range: { date: "2026-09-13", start: "09:00", end: "09:20" } },
    ];
    const grid = [
      ["氏名", "9/12 09:20-09:40", "9/13 09:00-09:20"],
      ["山田太郎", "○", "○"],
    ];
    const drafts = buildPeopleFromWideFormat(grid, 0, crossDateColumns, slots);
    expect(drafts[0].available).toEqual([
      { date: "2026-09-12", start: "09:20", end: "09:40" },
      { date: "2026-09-13", start: "09:00", end: "09:20" },
    ]);
  });
});
