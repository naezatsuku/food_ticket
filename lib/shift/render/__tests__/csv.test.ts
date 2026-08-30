import { describe, expect, it } from "vitest";
import { buildLongFormatCsv, buildPersonCsv, buildWideFormatCsv } from "../csv";
import { createPerson, createRole, createTimeSlot, defaultShiftProject } from "../../types";
import type { ShiftProject } from "../../types";

function project(partial?: Partial<ShiftProject>): ShiftProject {
  return { ...defaultShiftProject(), id: "p", ...partial };
}

const slots = [
  createTimeSlot({ id: "s1", start: "09:00", end: "09:20" }),
  createTimeSlot({ id: "s2", start: "09:20", end: "09:40" }),
];
const roles = [createRole({ id: "r1", name: "レジ" }, 0), createRole({ id: "r2", name: "案内" }, 1)];
const people = [createPerson({ id: "p1", name: "山田" }), createPerson({ id: "p2", name: "鈴木" })];
const assignments = [
  { slotId: "s1", roleId: "r1", personId: "p1", locked: false },
  { slotId: "s2", roleId: "r2", personId: "p2", locked: false },
];

describe("buildLongFormatCsv", () => {
  it("時刻順に1行1割当で出力する", () => {
    const csv = buildLongFormatCsv(project({ slots, roles, people, assignments }));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("時刻,役割,氏名");
    expect(lines[1]).toBe("09:00-09:20,レジ,山田");
    expect(lines[2]).toBe("09:20-09:40,案内,鈴木");
  });

  it("カンマを含む値はダブルクォートで囲む", () => {
    const csv = buildLongFormatCsv(
      project({
        slots: [slots[0]],
        roles: [createRole({ id: "r1", name: "レジ,案内" }, 0)],
        people,
        assignments: [{ slotId: "s1", roleId: "r1", personId: "p1", locked: false }],
      })
    );
    expect(csv).toContain('"レジ,案内"');
  });
});

describe("buildWideFormatCsv", () => {
  it("役割軸: 行=時刻、列=役割", () => {
    const csv = buildWideFormatCsv(project({ slots, roles, people, assignments }), "role");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("時刻,レジ,案内");
    expect(lines[1]).toBe("09:00-09:20,山田,");
    expect(lines[2]).toBe("09:20-09:40,,鈴木");
  });

  it("人軸: 行=時刻、列=人(役割名を表示)", () => {
    const csv = buildWideFormatCsv(project({ slots, roles, people, assignments }), "person");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("時刻,山田,鈴木");
    expect(lines[1]).toBe("09:00-09:20,レジ,");
    expect(lines[2]).toBe("09:20-09:40,,案内");
  });
});

describe("buildPersonCsv", () => {
  it("指定した人の担当だけを抽出する", () => {
    const csv = buildPersonCsv(project({ slots, roles, people, assignments }), "p2");
    const lines = csv.split("\r\n");
    expect(lines).toEqual(["時刻,役割", "09:20-09:40,案内"]);
  });

  it("担当が無ければヘッダのみ", () => {
    const csv = buildPersonCsv(project({ slots, roles, people, assignments }), "p1-nonexistent");
    expect(csv).toBe("時刻,役割");
  });
});
