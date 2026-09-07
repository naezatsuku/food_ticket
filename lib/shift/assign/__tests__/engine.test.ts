import { describe, expect, it } from "vitest";
import { buildScheduleResult, runAssignment } from "../engine";
import { createPerson, createRole, createTimeSlot, defaultShiftProject } from "../../types";
import type { ShiftProject } from "../../types";

function project(partial?: Partial<ShiftProject>): ShiftProject {
  return { ...defaultShiftProject(), id: "p", ...partial };
}

describe("runAssignment", () => {
  it("希望通りに入れる1人1枠を割り当てる", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 });
    const role = createRole({ id: "r1", name: "レジ", requirement: [{ slotId: "s1", min: 1, max: 1 }] }, 0);
    const person = createPerson({ id: "p1", name: "太郎", available: [{ date: "", start: "09:00", end: "09:20" }] });
    const result = runAssignment(
      project({ slots: [slot], roles: [role], people: [person], defaultMaxSlotsPerPerson: 8 })
    );
    expect(result.assignments).toEqual([{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }]);
    expect(result.unassignedPeople).toEqual([]);
    expect(result.understaffedSlots).toEqual([]);
  });

  it("入れる時間帯に一致する枠が無ければ未割当になり理由が付く", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 });
    const role = createRole({ id: "r1", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 0);
    const person = createPerson({ id: "p1", available: [{ date: "", start: "10:00", end: "10:20" }] });
    const result = runAssignment(project({ slots: [slot], roles: [role], people: [person] }));
    expect(result.unassignedPeople).toEqual([
      { personId: "p1", reason: "入れる時間帯に一致する枠がありません。" },
    ]);
  });

  it("希望時間帯の申告が無い人はその旨の理由になる", () => {
    const person = createPerson({ id: "p1", available: [] });
    const result = runAssignment(project({ people: [person] }));
    expect(result.unassignedPeople).toEqual([
      { personId: "p1", reason: "入れる時間帯の申告がありません。" },
    ]);
  });

  it("最低人数を満たせない枠は understaffedSlots に出る", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 2 });
    const role = createRole({ id: "r1", requirement: [{ slotId: "s1", min: 2, max: 2 }] }, 0);
    const person = createPerson({ id: "p1", available: [{ date: "", start: "09:00", end: "09:20" }] });
    const result = runAssignment(project({ slots: [slot], roles: [role], people: [person] }));
    expect(result.understaffedSlots).toEqual([{ slotId: "s1", roleId: "r1", shortage: 1 }]);
  });

  it("1人あたりの上限コマ数を超えて割り当てない", () => {
    const slots = [
      createTimeSlot({ id: "s1", start: "09:00", end: "09:20" }),
      createTimeSlot({ id: "s2", start: "09:20", end: "09:40" }),
    ];
    const role = createRole(
      { id: "r1", requirement: [{ slotId: "s1", min: 0, max: 1 }, { slotId: "s2", min: 0, max: 1 }] },
      0
    );
    const person = createPerson({
      id: "p1",
      maxSlots: 1,
      available: [{ date: "", start: "09:00", end: "09:40" }],
    });
    const result = runAssignment(project({ slots, roles: [role], people: [person] }));
    expect(result.assignments).toHaveLength(1);
  });

  it("同一時刻には1人1枠までしか割り当てない(別役割でも重複しない)", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 2 });
    const roleA = createRole({ id: "rA", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 0);
    const roleB = createRole({ id: "rB", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 1);
    const person = createPerson({ id: "p1", maxSlots: 5, available: [{ date: "", start: "09:00", end: "09:20" }] });
    const result = runAssignment(
      project({ slots: [slot], roles: [roleA, roleB], people: [person] })
    );
    expect(result.assignments).toHaveLength(1);
  });

  it("割当コマ数をできるだけ均等にする", () => {
    const slots = Array.from({ length: 4 }, (_, i) => {
      const hour = String(9 + i).padStart(2, "0");
      return createTimeSlot({ id: `s${i}`, start: `${hour}:00`, end: `${hour}:20`, capacity: 1 });
    });
    const role = createRole(
      { id: "r1", requirement: slots.map((s) => ({ slotId: s.id, min: 0, max: 1 })) },
      0
    );
    const people = [
      createPerson({ id: "p1", maxSlots: 4, available: [{ date: "", start: "09:00", end: "13:00" }] }),
      createPerson({ id: "p2", maxSlots: 4, available: [{ date: "", start: "09:00", end: "13:00" }] }),
    ];
    const result = runAssignment(project({ slots, roles: [role], people }));
    const counts = result.fairness.map((f) => f.assignedCount).sort();
    expect(counts).toEqual([2, 2]);
  });

  it("役割の優先度が高い人を優先的にその役割へ割り当てる", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 });
    const roleA = createRole({ id: "rA", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 0);
    const roleB = createRole({ id: "rB", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 1);
    const person = createPerson({
      id: "p1",
      maxSlots: 1,
      available: [{ date: "", start: "09:00", end: "09:20" }],
      rolePreference: { rA: 5, rB: 0 },
    });
    const result = runAssignment(project({ slots: [slot], roles: [roleA, roleB], people: [person] }));
    expect(result.assignments).toEqual([{ slotId: "s1", roleId: "rA", personId: "p1", locked: false }]);
  });

  it("ロック済みの割当は動かさず、残りだけ再最適化する", () => {
    const slots = [
      createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 }),
      createTimeSlot({ id: "s2", start: "09:20", end: "09:40", capacity: 1 }),
    ];
    const role = createRole(
      { id: "r1", requirement: [{ slotId: "s1", min: 1, max: 1 }, { slotId: "s2", min: 1, max: 1 }] },
      0
    );
    const people = [
      createPerson({ id: "p1", maxSlots: 2, available: [{ date: "", start: "09:00", end: "09:40" }] }),
      createPerson({ id: "p2", maxSlots: 2, available: [{ date: "", start: "09:00", end: "09:40" }] }),
    ];
    const proj = project({
      slots,
      roles: [role],
      people,
      // p2 を s1 にロック済みとして事前配置(本来 p1/p2 どちらでも良いはずの枠)
      assignments: [{ slotId: "s1", roleId: "r1", personId: "p2", locked: true }],
    });
    const result = runAssignment(proj);
    expect(result.assignments).toContainEqual({
      slotId: "s1",
      roleId: "r1",
      personId: "p2",
      locked: true,
    });
    // s2 は p1 が埋める(p2は既にs1で1コマ使っているため、ロックにより同時刻の重複も防がれる)
    expect(result.assignments).toContainEqual({
      slotId: "s2",
      roleId: "r1",
      personId: "p1",
      locked: false,
    });
    expect(result.assignments).toHaveLength(2);
  });
});

describe("buildScheduleResult", () => {
  it("assignments からサマリを再構築できる(純粋関数)", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 });
    const role = createRole({ id: "r1", requirement: [{ slotId: "s1", min: 1, max: 1 }] }, 0);
    const person = createPerson({ id: "p1" });
    const proj = project({ slots: [slot], roles: [role], people: [person] });
    const result = buildScheduleResult(proj, [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }]);
    expect(result.fairness).toEqual([{ personId: "p1", assignedCount: 1 }]);
    expect(result.understaffedSlots).toEqual([]);
  });
});
