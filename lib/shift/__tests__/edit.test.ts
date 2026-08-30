import { describe, expect, it } from "vitest";
import { cellOccupants, checkDropViolations, personAvailableAtSlot, unassignedPeople } from "../edit";
import { createPerson, createRole, createTimeSlot, defaultShiftProject } from "../types";
import type { ShiftProject } from "../types";

function project(partial?: Partial<ShiftProject>): ShiftProject {
  return { ...defaultShiftProject(), id: "p", ...partial };
}

describe("cellOccupants", () => {
  it("指定した枠×役割の割当だけを返す", () => {
    const assignments = [
      { slotId: "s1", roleId: "r1", personId: "p1", locked: false },
      { slotId: "s1", roleId: "r2", personId: "p2", locked: false },
      { slotId: "s2", roleId: "r1", personId: "p3", locked: false },
    ];
    expect(cellOccupants(assignments, { slotId: "s1", roleId: "r1" })).toEqual([assignments[0]]);
  });
});

describe("unassignedPeople", () => {
  it("assignments に一件も現れない人だけを返す", () => {
    const people = [createPerson({ id: "p1" }), createPerson({ id: "p2" })];
    const proj = project({
      people,
      assignments: [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }],
    });
    expect(unassignedPeople(proj).map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("checkDropViolations", () => {
  const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 1 });
  const role = createRole({ id: "r1", requirement: [{ slotId: "s1", min: 0, max: 1 }] }, 0);

  it("希望時間帯内・定員内なら違反なし", () => {
    const person = createPerson({ id: "p1", available: [{ start: "09:00", end: "09:20" }] });
    const proj = project({ slots: [slot], roles: [role], people: [person] });
    expect(checkDropViolations(proj, "p1", { slotId: "s1", roleId: "r1" })).toEqual([]);
  });

  it("希望時間帯外なら unavailable 違反", () => {
    const person = createPerson({ id: "p1", available: [{ start: "10:00", end: "10:20" }] });
    const proj = project({ slots: [slot], roles: [role], people: [person] });
    const violations = checkDropViolations(proj, "p1", { slotId: "s1", roleId: "r1" });
    expect(violations.map((v) => v.kind)).toEqual(["unavailable"]);
  });

  it("既に定員に達しているなら overCapacity 違反", () => {
    const person = createPerson({ id: "p2", available: [{ start: "09:00", end: "09:20" }] });
    const proj = project({
      slots: [slot],
      roles: [role],
      people: [person],
      assignments: [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }],
    });
    const violations = checkDropViolations(proj, "p2", { slotId: "s1", roleId: "r1" });
    expect(violations.map((v) => v.kind)).toEqual(["overCapacity"]);
  });

  it("既に自分がそのセルにいる場合は overCapacity にならない(セル内入れ替え等)", () => {
    const person = createPerson({ id: "p1", available: [{ start: "09:00", end: "09:20" }] });
    const proj = project({
      slots: [slot],
      roles: [role],
      people: [person],
      assignments: [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }],
    });
    expect(checkDropViolations(proj, "p1", { slotId: "s1", roleId: "r1" })).toEqual([]);
  });
});

describe("personAvailableAtSlot", () => {
  it("入れる時間帯なら true", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20" });
    const person = createPerson({ id: "p1", available: [{ start: "09:00", end: "09:20" }] });
    const proj = project({ slots: [slot], people: [person] });
    expect(personAvailableAtSlot(proj, "p1", "s1")).toBe(true);
  });
  it("入れない時間帯なら false", () => {
    const slot = createTimeSlot({ id: "s1", start: "09:00", end: "09:20" });
    const person = createPerson({ id: "p1", available: [] });
    const proj = project({ slots: [slot], people: [person] });
    expect(personAvailableAtSlot(proj, "p1", "s1")).toBe(false);
  });
});
