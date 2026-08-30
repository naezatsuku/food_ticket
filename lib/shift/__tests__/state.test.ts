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

  it("slot/remove すると、その枠を参照する割当も消える", () => {
    let state = reducer(defaultShiftProject(), {
      type: "slotGeneration/set",
      patch: { start: "09:00", end: "09:20", intervalMinutes: 20, breaks: [] },
    });
    state = reducer(state, { type: "slotGeneration/apply" });
    const slotId = state.slots[0].id;
    state = reducer(state, {
      type: "assignments/replace",
      assignments: [{ slotId, roleId: "r1", personId: "p1", locked: false }],
    });
    state = reducer(state, { type: "slot/remove", id: slotId });
    expect(state.assignments).toEqual([]);
  });

  it("people/remove すると、その人の割当も消える(他の割当は残る)", () => {
    let state = reducer(defaultShiftProject(), {
      type: "slotGeneration/set",
      patch: { start: "09:00", end: "09:20", intervalMinutes: 20, breaks: [] },
    });
    state = reducer(state, { type: "slotGeneration/apply" });
    state = reducer(state, { type: "role/add" });
    const slotId = state.slots[0].id;
    const roleId = state.roles[0].id;
    state = reducer(state, {
      type: "people/replace",
      people: [
        { id: "p1", name: "A", available: [], maxSlots: null, rolePreference: {} },
        { id: "p2", name: "B", available: [], maxSlots: null, rolePreference: {} },
      ],
    });
    state = reducer(state, {
      type: "assignments/replace",
      assignments: [
        { slotId, roleId, personId: "p1", locked: false },
        { slotId, roleId, personId: "p2", locked: false },
      ],
    });
    state = reducer(state, { type: "people/remove", id: "p1" });
    expect(state.assignments).toEqual([{ slotId, roleId, personId: "p2", locked: false }]);
  });

  it("assignments/place で手動配置するとロック済みになる", () => {
    const state = reducer(defaultShiftProject(), {
      type: "assignments/place",
      slotId: "s1",
      roleId: "r1",
      personId: "p1",
    });
    expect(state.assignments).toEqual([{ slotId: "s1", roleId: "r1", personId: "p1", locked: true }]);
  });

  it("assignments/place は同じセルへの重複を無視する", () => {
    let state = reducer(defaultShiftProject(), {
      type: "assignments/place",
      slotId: "s1",
      roleId: "r1",
      personId: "p1",
    });
    state = reducer(state, { type: "assignments/place", slotId: "s1", roleId: "r1", personId: "p1" });
    expect(state.assignments).toHaveLength(1);
  });

  it("assignments/remove で割当を取り除く", () => {
    let state = reducer(defaultShiftProject(), {
      type: "assignments/place",
      slotId: "s1",
      roleId: "r1",
      personId: "p1",
    });
    state = reducer(state, { type: "assignments/remove", slotId: "s1", roleId: "r1", personId: "p1" });
    expect(state.assignments).toEqual([]);
  });

  it("assignments/swap で2人の配置先を入れ替え、両方ロックする", () => {
    let state = reducer(defaultShiftProject(), {
      type: "assignments/replace",
      assignments: [
        { slotId: "s1", roleId: "r1", personId: "p1", locked: false },
        { slotId: "s2", roleId: "r1", personId: "p2", locked: false },
      ],
    });
    state = reducer(state, {
      type: "assignments/swap",
      a: { slotId: "s1", roleId: "r1", personId: "p1" },
      b: { slotId: "s2", roleId: "r1", personId: "p2" },
    });
    expect(state.assignments).toEqual([
      { slotId: "s2", roleId: "r1", personId: "p1", locked: true },
      { slotId: "s1", roleId: "r1", personId: "p2", locked: true },
    ]);
  });

  it("assignments/toggleLock でロック状態を反転する", () => {
    let state = reducer(defaultShiftProject(), {
      type: "assignments/replace",
      assignments: [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }],
    });
    state = reducer(state, {
      type: "assignments/toggleLock",
      slotId: "s1",
      roleId: "r1",
      personId: "p1",
    });
    expect(state.assignments[0].locked).toBe(true);
    state = reducer(state, {
      type: "assignments/toggleLock",
      slotId: "s1",
      roleId: "r1",
      personId: "p1",
    });
    expect(state.assignments[0].locked).toBe(false);
  });
});
