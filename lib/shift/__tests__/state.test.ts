import { describe, expect, it } from "vitest";
import { reducer } from "../state";
import { defaultShiftProject } from "../types";

describe("reducer", () => {
  it("project/rename", () => {
    const next = reducer(defaultShiftProject(), { type: "project/rename", name: "文化祭" });
    expect(next.name).toBe("文化祭");
  });

  it("slotGeneration/apply で枠を生成する", () => {
    const state = {
      ...defaultShiftProject(),
      slotGeneration: { start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] },
    };
    const next = reducer(state, { type: "slotGeneration/apply" });
    expect(next.slots).toHaveLength(3);
  });

  it("slot/remove すると対応する役割の必要人数設定も消える", () => {
    let state = reducer(defaultShiftProject(), {
      type: "slotGeneration/set",
      patch: { start: "09:00", end: "09:40", intervalMinutes: 20, breaks: [] },
    });
    state = reducer(state, { type: "slotGeneration/apply" });
    state = reducer(state, { type: "role/add" });
    const slotId = state.slots[0].id;
    const roleId = state.roles[0].id;
    state = reducer(state, {
      type: "requirement/set",
      roleId,
      slotId,
      patch: { min: 1, max: 1 },
    });
    expect(state.roles[0].requirement).toHaveLength(1);

    state = reducer(state, { type: "slot/remove", id: slotId });
    expect(state.slots).toHaveLength(1);
    expect(state.roles[0].requirement).toHaveLength(0);
  });

  it("requirement/bulkApply は全ての枠に同じ値を適用する", () => {
    let state = reducer(defaultShiftProject(), {
      type: "slotGeneration/set",
      patch: { start: "09:00", end: "10:00", intervalMinutes: 20, breaks: [] },
    });
    state = reducer(state, { type: "slotGeneration/apply" });
    state = reducer(state, { type: "role/add" });
    const roleId = state.roles[0].id;
    state = reducer(state, { type: "requirement/bulkApply", roleId, min: 1, max: 2 });
    expect(state.roles[0].requirement).toHaveLength(3);
    expect(state.roles[0].requirement.every((r) => r.min === 1 && r.max === 2)).toBe(true);
  });

  it("role/remove で役割を削除する", () => {
    let state = reducer(defaultShiftProject(), { type: "role/add" });
    const roleId = state.roles[0].id;
    state = reducer(state, { type: "role/remove", id: roleId });
    expect(state.roles).toHaveLength(0);
  });
});
