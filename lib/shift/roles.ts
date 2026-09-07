import type { Role, RoleRequirement, TimeSlot } from "./types";

/** 指定した枠に対する役割の必要人数設定を取得する(未設定なら 0/0) */
export function requirementFor(role: Role, slotId: string): RoleRequirement {
  return role.requirement.find((r) => r.slotId === slotId) ?? { slotId, min: 0, max: 0 };
}

/** 指定した枠に対する役割の必要人数設定を更新した Role を返す(イミュータブル) */
export function setRequirement(
  role: Role,
  slotId: string,
  patch: Partial<Pick<RoleRequirement, "min" | "max">>
): Role {
  const existing = role.requirement.find((r) => r.slotId === slotId);
  const next: RoleRequirement = { slotId, min: existing?.min ?? 0, max: existing?.max ?? 0, ...patch };
  const requirement = existing
    ? role.requirement.map((r) => (r.slotId === slotId ? next : r))
    : [...role.requirement, next];
  return { ...role, requirement };
}

export interface SlotOverCapacityWarning {
  slotId: string;
  /** 役割の最低人数の合計 */
  totalMin: number;
  /** 枠の定員 */
  capacity: number;
}

/** 役割ごとの最低人数の合計が枠の定員を超えている枠を検出する */
export function checkSlotOverCapacity(
  slots: TimeSlot[],
  roles: Role[]
): SlotOverCapacityWarning[] {
  return slots
    .map((slot) => ({
      slotId: slot.id,
      totalMin: roles.reduce((sum, role) => sum + requirementFor(role, slot.id).min, 0),
      capacity: slot.capacity,
    }))
    .filter((w) => w.totalMin > w.capacity);
}
