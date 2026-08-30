import { isPersonAvailableForSlot } from "./availability";
import { requirementFor } from "./roles";
import type { Assignment, Person, ShiftProject } from "./types";

export interface DropTarget {
  slotId: string;
  roleId: string;
}

/** 指定した枠×役割セルに割り当て済みの assignment 一覧 */
export function cellOccupants(assignments: Assignment[], target: DropTarget): Assignment[] {
  return assignments.filter((a) => a.slotId === target.slotId && a.roleId === target.roleId);
}

/** どこにも割り当てられていない人(未割当プールの対象) */
export function unassignedPeople(project: ShiftProject): Person[] {
  const assignedIds = new Set(project.assignments.map((a) => a.personId));
  return project.people.filter((p) => !assignedIds.has(p.id));
}

export interface DropViolation {
  kind: "unavailable" | "overCapacity";
  message: string;
}

/**
 * 指定した人を指定セルへドロップしたときのハード制約違反を検出する。
 * (personId 自身が既にそのセルにいる場合はカウントしない。移動先が
 * 元と同じセルの場合や、セル内でのカード入れ替えを想定した呼び出し向け)
 */
export function checkDropViolations(
  project: ShiftProject,
  personId: string,
  target: DropTarget
): DropViolation[] {
  const violations: DropViolation[] = [];
  const person = project.people.find((p) => p.id === personId);
  const slot = project.slots.find((s) => s.id === target.slotId);
  const role = project.roles.find((r) => r.id === target.roleId);

  if (person && slot && !isPersonAvailableForSlot(person, slot)) {
    violations.push({ kind: "unavailable", message: "希望外の時間帯です。" });
  }
  if (role) {
    const occupants = cellOccupants(project.assignments, target).filter((a) => a.personId !== personId);
    const capacity = requirementFor(role, target.slotId).max;
    if (occupants.length >= capacity) {
      violations.push({ kind: "overCapacity", message: "この枠は定員に達しています。" });
    }
  }
  return violations;
}

/** そのセルに、その人が入れるか(グリッドのハイライト用の軽量判定) */
export function personAvailableAtSlot(project: ShiftProject, personId: string, slotId: string): boolean {
  const person = project.people.find((p) => p.id === personId);
  const slot = project.slots.find((s) => s.id === slotId);
  if (!person || !slot) return false;
  return isPersonAvailableForSlot(person, slot);
}
