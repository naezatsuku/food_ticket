import type { ShiftProject } from "../types";

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsvString(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function sortedSlots(project: ShiftProject) {
  return [...project.slots].sort((a, b) => a.start.localeCompare(b.start));
}

/** ロング形式(1行=1割当: 時刻,役割,氏名) */
export function buildLongFormatCsv(project: ShiftProject): string {
  const personById = new Map(project.people.map((p) => [p.id, p]));
  const slotById = new Map(project.slots.map((s) => [s.id, s]));
  const roleById = new Map(project.roles.map((r) => [r.id, r]));

  const sorted = [...project.assignments].sort((a, b) => {
    const sa = slotById.get(a.slotId)?.start ?? "";
    const sb = slotById.get(b.slotId)?.start ?? "";
    return sa.localeCompare(sb) || a.roleId.localeCompare(b.roleId);
  });

  const rows: string[][] = [["時刻", "役割", "氏名"]];
  for (const a of sorted) {
    const slot = slotById.get(a.slotId);
    rows.push([
      slot ? `${slot.start}-${slot.end}` : a.slotId,
      roleById.get(a.roleId)?.name ?? a.roleId,
      personById.get(a.personId)?.name ?? a.personId,
    ]);
  }
  return toCsvString(rows);
}

export type WideAxis = "role" | "person";

/** ワイド形式(行=時間枠、列=役割 または 人) */
export function buildWideFormatCsv(project: ShiftProject, axis: WideAxis): string {
  const slots = sortedSlots(project);

  if (axis === "role") {
    const personById = new Map(project.people.map((p) => [p.id, p]));
    const header = ["時刻", ...project.roles.map((r) => r.name || "無題")];
    const rows: string[][] = [header];
    for (const slot of slots) {
      const row = [`${slot.start}-${slot.end}`];
      for (const role of project.roles) {
        const names = project.assignments
          .filter((a) => a.slotId === slot.id && a.roleId === role.id)
          .map((a) => personById.get(a.personId)?.name ?? a.personId);
        row.push(names.join("、"));
      }
      rows.push(row);
    }
    return toCsvString(rows);
  }

  const roleById = new Map(project.roles.map((r) => [r.id, r]));
  const header = ["時刻", ...project.people.map((p) => p.name || "無題")];
  const rows: string[][] = [header];
  for (const slot of slots) {
    const row = [`${slot.start}-${slot.end}`];
    for (const person of project.people) {
      const a = project.assignments.find((x) => x.slotId === slot.id && x.personId === person.id);
      row.push(a ? (roleById.get(a.roleId)?.name ?? a.roleId) : "");
    }
    rows.push(row);
  }
  return toCsvString(rows);
}

/** 個人別(その人の担当だけ)のCSV */
export function buildPersonCsv(project: ShiftProject, personId: string): string {
  const slotById = new Map(project.slots.map((s) => [s.id, s]));
  const roleById = new Map(project.roles.map((r) => [r.id, r]));

  const mine = project.assignments
    .filter((a) => a.personId === personId)
    .sort((a, b) => {
      const sa = slotById.get(a.slotId)?.start ?? "";
      const sb = slotById.get(b.slotId)?.start ?? "";
      return sa.localeCompare(sb);
    });

  const rows: string[][] = [["時刻", "役割"]];
  for (const a of mine) {
    const slot = slotById.get(a.slotId);
    rows.push([slot ? `${slot.start}-${slot.end}` : a.slotId, roleById.get(a.roleId)?.name ?? a.roleId]);
  }
  return toCsvString(rows);
}
