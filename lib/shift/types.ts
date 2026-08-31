/** 1つの時間枠(コマ) */
export interface TimeSlot {
  id: string;
  /** "10:00" 形式 */
  start: string;
  /** "10:20" 形式 */
  end: string;
  /** 枠全体の必要人数(定員) */
  capacity: number;
}

/** 休憩時間帯(枠を作らない時間) */
export interface BreakPeriod {
  start: string;
  end: string;
}

/** 時間枠の一括生成設定 */
export interface SlotGenerationSettings {
  start: string;
  end: string;
  /** 1コマの長さ(分) */
  intervalMinutes: number;
  breaks: BreakPeriod[];
}

/** 毎回使い回す枠構成のプリセット(プロジェクトを跨いで再利用する) */
export interface SlotPreset {
  id: string;
  name: string;
  slotGeneration: SlotGenerationSettings;
}

/** 役割ごと・枠ごとの必要人数 */
export interface RoleRequirement {
  slotId: string;
  /** 最低人数 */
  min: number;
  /** 上限人数 */
  max: number;
}

/** 役割(レジ・案内など) */
export interface Role {
  id: string;
  name: string;
  colorHex: string;
  /** 枠ごとに上書きできる必要人数 */
  requirement: RoleRequirement[];
}

/** メンバーが入れる時間帯 */
export interface AvailabilityRange {
  start: string;
  end: string;
}

/** メンバー(希望提出者) */
export interface Person {
  id: string;
  name: string;
  available: AvailabilityRange[];
  /** 上限コマ数(未指定ならプロジェクトの既定値を使う) */
  maxSlots: number | null;
  /** 役割ID -> 優先度(0〜5) */
  rolePreference: Record<string, number>;
}

/** 割当の1件 */
export interface Assignment {
  slotId: string;
  roleId: string;
  personId: string;
  /** 手動編集で固定したものは再計算で動かさない */
  locked: boolean;
}

/** 自動割当の結果サマリ */
export interface ScheduleResult {
  assignments: Assignment[];
  unassignedPeople: { personId: string; reason: string }[];
  understaffedSlots: { slotId: string; roleId: string; shortage: number }[];
  fairness: { personId: string; assignedCount: number }[];
}

/** シフト表1つ分のプロジェクトデータ(localStorage / JSON エクスポート対象) */
export interface ShiftProject {
  id: string;
  name: string;
  slotGeneration: SlotGenerationSettings;
  slots: TimeSlot[];
  roles: Role[];
  people: Person[];
  assignments: Assignment[];
  /** 1人あたりの既定上限コマ数 */
  defaultMaxSlotsPerPerson: number;
}

const ROLE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function roleColorForIndex(index: number): string {
  return ROLE_COLORS[index % ROLE_COLORS.length];
}

export function createRole(partial: Partial<Role> | undefined, existingCount: number): Role {
  return {
    id: crypto.randomUUID(),
    name: "",
    colorHex: roleColorForIndex(existingCount),
    requirement: [],
    ...partial,
  };
}

export function createTimeSlot(partial?: Partial<TimeSlot>): TimeSlot {
  return {
    id: crypto.randomUUID(),
    start: "09:00",
    end: "09:20",
    capacity: 1,
    ...partial,
  };
}

export function createPerson(partial?: Partial<Person>): Person {
  return {
    id: crypto.randomUUID(),
    name: "",
    available: [],
    maxSlots: null,
    rolePreference: {},
    ...partial,
  };
}

export function createSlotPreset(name: string, slotGeneration: SlotGenerationSettings): SlotPreset {
  return { id: crypto.randomUUID(), name, slotGeneration };
}

export function defaultShiftProject(): ShiftProject {
  return {
    id: "default",
    name: "",
    slotGeneration: {
      start: "09:00",
      end: "17:00",
      intervalMinutes: 20,
      breaks: [],
    },
    slots: [],
    roles: [],
    people: [],
    assignments: [],
    defaultMaxSlotsPerPerson: 8,
  };
}
