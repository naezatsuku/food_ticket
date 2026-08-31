import { describe, expect, it } from "vitest";
import { computeCanvasSize } from "../canvas";
import { createRole, createTimeSlot, defaultShiftProject } from "../../types";
import type { ShiftProject } from "../../types";

function project(partial?: Partial<ShiftProject>): ShiftProject {
  return { ...defaultShiftProject(), id: "p", ...partial };
}

describe("computeCanvasSize", () => {
  it("枠・役割が無くても最小サイズを返す(0除算等をしない)", () => {
    const { width, height } = computeCanvasSize(project(), { date: "" });
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("枠が増えるほど縦に、役割が増えるほど横に大きくなる", () => {
    const base = computeCanvasSize(project(), { date: "" });
    const moreSlots = computeCanvasSize(
      project({ slots: [createTimeSlot(), createTimeSlot(), createTimeSlot()] }),
      { date: "" }
    );
    const moreRoles = computeCanvasSize(
      project({ roles: [createRole(undefined, 0), createRole(undefined, 1)] }),
      { date: "" }
    );
    expect(moreSlots.height).toBeGreaterThan(base.height);
    expect(moreSlots.width).toBe(base.width);
    expect(moreRoles.width).toBeGreaterThan(base.width);
  });

  it("subtitleがあると縦に少し大きくなる", () => {
    const withoutSubtitle = computeCanvasSize(project(), { date: "" });
    const withSubtitle = computeCanvasSize(project(), { subtitle: "2026-08-30", date: "" });
    expect(withSubtitle.height).toBeGreaterThan(withoutSubtitle.height);
  });

  it("指定した日付以外の枠はカウントしない(日付跨ぎ対応)", () => {
    const slots = [
      createTimeSlot({ date: "2026-09-12" }),
      createTimeSlot({ date: "2026-09-12" }),
      createTimeSlot({ date: "2026-09-13" }),
    ];
    const sizeFor12 = computeCanvasSize(project({ slots }), { date: "2026-09-12" });
    const sizeFor13 = computeCanvasSize(project({ slots }), { date: "2026-09-13" });
    expect(sizeFor12.height).toBeGreaterThan(sizeFor13.height);
  });
});
