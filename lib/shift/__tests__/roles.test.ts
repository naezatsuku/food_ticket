import { describe, expect, it } from "vitest";
import { checkSlotOverCapacity, requirementFor, setRequirement } from "../roles";
import type { Role, TimeSlot } from "../types";

function makeRole(partial?: Partial<Role>): Role {
  return { id: "r1", name: "レジ", colorHex: "#3b82f6", requirement: [], ...partial };
}

function makeSlot(partial?: Partial<TimeSlot>): TimeSlot {
  return { id: "s1", start: "09:00", end: "09:20", capacity: 2, ...partial };
}

describe("requirementFor", () => {
  it("未設定なら 0/0 を返す", () => {
    expect(requirementFor(makeRole(), "s1")).toEqual({ slotId: "s1", min: 0, max: 0 });
  });
  it("設定済みならその値を返す", () => {
    const role = makeRole({ requirement: [{ slotId: "s1", min: 1, max: 2 }] });
    expect(requirementFor(role, "s1")).toEqual({ slotId: "s1", min: 1, max: 2 });
  });
});

describe("setRequirement", () => {
  it("未設定の枠に新規追加する", () => {
    const role = setRequirement(makeRole(), "s1", { min: 1 });
    expect(role.requirement).toEqual([{ slotId: "s1", min: 1, max: 0 }]);
  });
  it("既存の設定を部分更新する", () => {
    const role = makeRole({ requirement: [{ slotId: "s1", min: 1, max: 2 }] });
    const next = setRequirement(role, "s1", { max: 5 });
    expect(next.requirement).toEqual([{ slotId: "s1", min: 1, max: 5 }]);
  });
  it("元のオブジェクトは変更しない(イミュータブル)", () => {
    const role = makeRole();
    setRequirement(role, "s1", { min: 1 });
    expect(role.requirement).toEqual([]);
  });
});

describe("checkSlotOverCapacity", () => {
  it("最低人数の合計が定員以下なら警告なし", () => {
    const slots = [makeSlot({ capacity: 2 })];
    const roles = [
      makeRole({ id: "r1", requirement: [{ slotId: "s1", min: 1, max: 1 }] }),
      makeRole({ id: "r2", requirement: [{ slotId: "s1", min: 1, max: 1 }] }),
    ];
    expect(checkSlotOverCapacity(slots, roles)).toEqual([]);
  });
  it("最低人数の合計が定員を超えると警告する", () => {
    const slots = [makeSlot({ capacity: 2 })];
    const roles = [
      makeRole({ id: "r1", requirement: [{ slotId: "s1", min: 2, max: 2 }] }),
      makeRole({ id: "r2", requirement: [{ slotId: "s1", min: 1, max: 1 }] }),
    ];
    expect(checkSlotOverCapacity(slots, roles)).toEqual([
      { slotId: "s1", totalMin: 3, capacity: 2 },
    ]);
  });
});
