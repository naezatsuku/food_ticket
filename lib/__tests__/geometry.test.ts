import { describe, expect, it } from "vitest";
import {
  autoGrid,
  columnEdges,
  resolveGrid,
  rowEdges,
  sheetSizeMm,
  sheetsNeeded,
  ticketOrigins,
  validateLayout,
} from "../geometry";
import type { SheetSettings, TicketSettings } from "../types";

const ticket90x50: TicketSettings = {
  widthMm: 90,
  heightMm: 50,
  stubEnabled: false,
  stubWidthMm: 25,
  borderWidthMm: 0.5,
};

const a4Sheet: SheetSettings = {
  paper: "A4",
  orientation: "portrait",
  marginMm: 10,
  gapMm: 0,
  cutGuide: "dashed",
  manualGrid: null,
};

describe("sheetSizeMm", () => {
  it("A4縦は210×297", () => {
    expect(sheetSizeMm("A4", "portrait")).toEqual({ w: 210, h: 297 });
  });
  it("A4横は297×210", () => {
    expect(sheetSizeMm("A4", "landscape")).toEqual({ w: 297, h: 210 });
  });
  it("B5/A3も正しい", () => {
    expect(sheetSizeMm("B5", "portrait")).toEqual({ w: 182, h: 257 });
    expect(sheetSizeMm("A3", "portrait")).toEqual({ w: 297, h: 420 });
  });
});

describe("autoGrid", () => {
  it("A4縦・余白10mm・90×50mm券 → 2列×5行", () => {
    expect(autoGrid(210, 297, 10, 90, 50)).toEqual({ cols: 2, rows: 5 });
  });
  it("券が大きすぎる場合は0", () => {
    expect(autoGrid(210, 297, 10, 200, 50)).toEqual({ cols: 0, rows: 5 });
  });
  it("余白が大きいと入る枚数が減る", () => {
    expect(autoGrid(210, 297, 20, 90, 50)).toEqual({ cols: 1, rows: 5 });
  });
  it("券の間隔(gapMm)が大きいと入る枚数が減る", () => {
    expect(autoGrid(210, 297, 10, 90, 50, 15)).toEqual({ cols: 1, rows: 4 });
  });
  it("gapMm=0 なら従来どおり", () => {
    expect(autoGrid(210, 297, 10, 90, 50, 0)).toEqual({ cols: 2, rows: 5 });
  });
});

describe("resolveGrid / ticketOrigins", () => {
  it("グリッドは印刷可能領域の中央に配置される", () => {
    const grid = resolveGrid(ticket90x50, a4Sheet);
    expect(grid.rows).toBe(5);
    expect(grid.cols).toBe(2);
    // 210 - 180 = 30 → 左右15mm
    expect(grid.originX).toBeCloseTo(15);
    // 297 - 250 = 47 → 上下23.5mm
    expect(grid.originY).toBeCloseTo(23.5);
  });

  it("手動グリッドが優先される", () => {
    const grid = resolveGrid(ticket90x50, { ...a4Sheet, manualGrid: { rows: 3, cols: 1 } });
    expect(grid.rows).toBe(3);
    expect(grid.cols).toBe(1);
  });

  it("ticketOriginsは行優先で rows*cols 個返す", () => {
    const grid = resolveGrid(ticket90x50, a4Sheet);
    const origins = ticketOrigins(grid, 90, 50);
    expect(origins).toHaveLength(10);
    expect(origins[0]).toEqual({ x: 15, y: 23.5 });
    expect(origins[1]).toEqual({ x: 105, y: 23.5 });
    expect(origins[2]).toEqual({ x: 15, y: 73.5 });
  });

  it("gapMm を指定すると隙間込みで中央寄せされ、券間が離れる", () => {
    const gappedSheet: SheetSettings = { ...a4Sheet, gapMm: 10 };
    const grid = resolveGrid(ticket90x50, gappedSheet);
    // 縦は 50mm+隙間10mm=60mm ピッチ → 277mm領域に4枚(4×60-10=230mm)
    expect(grid.rows).toBe(4);
    expect(grid.cols).toBe(2);
    // 券幅190mm + 隙間10mm = 190mm、余白領域190mmちょうど → 左右0mm、印刷余白10mmのみ
    expect(grid.originX).toBeCloseTo(10);
    const origins = ticketOrigins(grid, 90, 50, 10);
    expect(origins[0]).toEqual({ x: 10, y: grid.originY });
    expect(origins[1]).toEqual({ x: 110, y: grid.originY });
  });
});

describe("columnEdges / rowEdges", () => {
  it("gapMm=0 なら券同士が接するので境界線は cols+1 本", () => {
    const grid = { rows: 1, cols: 2, originX: 0, originY: 0 };
    expect(columnEdges(grid, 50, 0)).toEqual([0, 50, 100]);
  });
  it("gapMm>0 なら各券の左右の辺がそれぞれ現れる", () => {
    const grid = { rows: 1, cols: 2, originX: 0, originY: 0 };
    expect(columnEdges(grid, 50, 5)).toEqual([0, 50, 55, 105]);
  });
  it("rowEdgesも同様", () => {
    const grid = { rows: 2, cols: 1, originX: 0, originY: 0 };
    expect(rowEdges(grid, 30, 5)).toEqual([0, 30, 35, 65]);
  });
});

describe("sheetsNeeded", () => {
  it("40枚・10枚/シート → 4シート", () => {
    expect(sheetsNeeded(40, 10)).toBe(4);
  });
  it("41枚 → 5シート", () => {
    expect(sheetsNeeded(41, 10)).toBe(5);
  });
  it("0枚 → 0シート", () => {
    expect(sheetsNeeded(0, 10)).toBe(0);
  });
  it("perSheet=0 は 0(ゼロ除算回避)", () => {
    expect(sheetsNeeded(10, 0)).toBe(0);
  });
});

describe("validateLayout", () => {
  it("正常な設定はエラーなし", () => {
    expect(validateLayout(ticket90x50, a4Sheet)).toEqual([]);
  });
  it("券が用紙に収まらない場合はエラー", () => {
    const errors = validateLayout({ ...ticket90x50, widthMm: 300 }, a4Sheet);
    expect(errors.some((e) => e.includes("収まりません"))).toBe(true);
  });
  it("手動グリッドが領域を超える場合はエラー", () => {
    const errors = validateLayout(ticket90x50, { ...a4Sheet, manualGrid: { rows: 6, cols: 2 } });
    expect(errors.some((e) => e.includes("収まりません"))).toBe(true);
  });
  it("手動グリッドが収まる場合はエラーなし", () => {
    expect(validateLayout(ticket90x50, { ...a4Sheet, manualGrid: { rows: 5, cols: 2 } })).toEqual([]);
  });
  it("半券幅が広すぎる場合はエラー", () => {
    const errors = validateLayout(
      { ...ticket90x50, stubEnabled: true, stubWidthMm: 85 },
      a4Sheet
    );
    expect(errors.some((e) => e.includes("半券"))).toBe(true);
  });
});
