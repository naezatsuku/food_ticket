import { generateSlots } from "./slots";
import { createRole, createTimeSlot } from "./types";
import { setRequirement } from "./roles";
import type {
  Assignment,
  BreakPeriod,
  Person,
  Role,
  ShiftProject,
  SlotGenerationSettings,
  TimeSlot,
} from "./types";

export type Action =
  | { type: "project/rename"; name: string }
  | { type: "project/setDefaultMaxSlots"; value: number }
  | { type: "slotGeneration/set"; patch: Partial<SlotGenerationSettings> }
  | { type: "slotGeneration/addBreak" }
  | { type: "slotGeneration/updateBreak"; index: number; patch: Partial<BreakPeriod> }
  | { type: "slotGeneration/removeBreak"; index: number }
  | { type: "slotGeneration/apply" }
  | { type: "slot/add" }
  | { type: "slot/update"; id: string; patch: Partial<TimeSlot> }
  | { type: "slot/remove"; id: string }
  | { type: "role/add" }
  | { type: "role/update"; id: string; patch: Partial<Pick<Role, "name" | "colorHex">> }
  | { type: "role/remove"; id: string }
  | { type: "requirement/set"; roleId: string; slotId: string; patch: { min?: number; max?: number } }
  | { type: "requirement/bulkApply"; roleId: string; min: number; max: number }
  | { type: "people/replace"; people: Person[] }
  | { type: "people/update"; id: string; patch: Partial<Person> }
  | { type: "people/remove"; id: string }
  | { type: "people/clear" }
  | { type: "assignments/replace"; assignments: Assignment[] }
  | { type: "state/replace"; project: ShiftProject };

/** 存在しなくなった枠IDへの必要人数設定を取り除く */
function pruneRequirements(roles: Role[], validSlotIds: Set<string>): Role[] {
  return roles.map((r) => ({
    ...r,
    requirement: r.requirement.filter((req) => validSlotIds.has(req.slotId)),
  }));
}

/** 削除された枠・役割・人を参照する割当を取り除く */
function pruneAssignments(
  assignments: Assignment[],
  validSlotIds: Set<string>,
  validRoleIds: Set<string>,
  validPersonIds: Set<string>
): Assignment[] {
  return assignments.filter(
    (a) => validSlotIds.has(a.slotId) && validRoleIds.has(a.roleId) && validPersonIds.has(a.personId)
  );
}

export function reducer(state: ShiftProject, action: Action): ShiftProject {
  switch (action.type) {
    case "project/rename":
      return { ...state, name: action.name };
    case "project/setDefaultMaxSlots":
      return { ...state, defaultMaxSlotsPerPerson: action.value };

    case "slotGeneration/set":
      return { ...state, slotGeneration: { ...state.slotGeneration, ...action.patch } };
    case "slotGeneration/addBreak":
      return {
        ...state,
        slotGeneration: {
          ...state.slotGeneration,
          breaks: [...state.slotGeneration.breaks, { start: "12:00", end: "13:00" }],
        },
      };
    case "slotGeneration/updateBreak":
      return {
        ...state,
        slotGeneration: {
          ...state.slotGeneration,
          breaks: state.slotGeneration.breaks.map((b, i) =>
            i === action.index ? { ...b, ...action.patch } : b
          ),
        },
      };
    case "slotGeneration/removeBreak":
      return {
        ...state,
        slotGeneration: {
          ...state.slotGeneration,
          breaks: state.slotGeneration.breaks.filter((_, i) => i !== action.index),
        },
      };
    case "slotGeneration/apply": {
      const slots = generateSlots(state.slotGeneration);
      const roles = pruneRequirements(state.roles, new Set(slots.map((s) => s.id)));
      return { ...state, slots, roles };
    }

    case "slot/add": {
      const last = state.slots[state.slots.length - 1];
      const slot = last
        ? createTimeSlot({ start: last.end, end: last.end })
        : createTimeSlot();
      return { ...state, slots: [...state.slots, slot] };
    }
    case "slot/update":
      return {
        ...state,
        slots: state.slots.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case "slot/remove": {
      const slots = state.slots.filter((s) => s.id !== action.id);
      const validSlotIds = new Set(slots.map((s) => s.id));
      const roles = pruneRequirements(state.roles, validSlotIds);
      const assignments = pruneAssignments(
        state.assignments,
        validSlotIds,
        new Set(roles.map((r) => r.id)),
        new Set(state.people.map((p) => p.id))
      );
      return { ...state, slots, roles, assignments };
    }

    case "role/add":
      return { ...state, roles: [...state.roles, createRole(undefined, state.roles.length)] };
    case "role/update":
      return {
        ...state,
        roles: state.roles.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "role/remove": {
      const roles = state.roles.filter((r) => r.id !== action.id);
      const assignments = pruneAssignments(
        state.assignments,
        new Set(state.slots.map((s) => s.id)),
        new Set(roles.map((r) => r.id)),
        new Set(state.people.map((p) => p.id))
      );
      return { ...state, roles, assignments };
    }

    case "requirement/set":
      return {
        ...state,
        roles: state.roles.map((r) =>
          r.id === action.roleId ? setRequirement(r, action.slotId, action.patch) : r
        ),
      };
    case "requirement/bulkApply":
      return {
        ...state,
        roles: state.roles.map((r) => {
          if (r.id !== action.roleId) return r;
          return state.slots.reduce(
            (role, slot) => setRequirement(role, slot.id, { min: action.min, max: action.max }),
            r
          );
        }),
      };

    case "people/replace": {
      const validPersonIds = new Set(action.people.map((p) => p.id));
      const assignments = pruneAssignments(
        state.assignments,
        new Set(state.slots.map((s) => s.id)),
        new Set(state.roles.map((r) => r.id)),
        validPersonIds
      );
      return { ...state, people: action.people, assignments };
    }
    case "people/update":
      return {
        ...state,
        people: state.people.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case "people/remove": {
      const people = state.people.filter((p) => p.id !== action.id);
      const assignments = pruneAssignments(
        state.assignments,
        new Set(state.slots.map((s) => s.id)),
        new Set(state.roles.map((r) => r.id)),
        new Set(people.map((p) => p.id))
      );
      return { ...state, people, assignments };
    }
    case "people/clear":
      return { ...state, people: [], assignments: [] };

    case "assignments/replace":
      return { ...state, assignments: action.assignments };

    case "state/replace":
      return action.project;
  }
}
