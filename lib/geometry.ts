import type { Orientation, PaperSize, SheetSettings, TicketSettings } from "./types";

/** 1mm = 72/25.4 pt(PDF出力時の換算係数) */
export const MM_TO_PT = 72 / 25.4;

/** 用紙サイズ(縦向き基準、mm) */
export const PAPER_SIZES_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  B5: { w: 182, h: 257 },
  A3: { w: 297, h: 420 },
};

/** 向きを加味したシート寸法(mm) */
export function sheetSizeMm(paper: PaperSize, orientation: Orientation): { w: number; h: number } {
  const base = PAPER_SIZES_MM[paper];
  return orientation === "portrait" ? { ...base } : { w: base.h, h: base.w };
}

export interface GridSpec {
  rows: number;
  cols: number;
  /** グリッド左上の用紙上の座標(mm)。印刷可能領域の中央に配置 */
  originX: number;
  originY: number;
}

/** 印刷可能領域に入る最大の行数×列数を自動計算する */
export function autoGrid(
  sheetW: number,
  sheetH: number,
  marginMm: number,
  ticketW: number,
  ticketH: number
): { rows: number; cols: number } {
  const availW = sheetW - marginMm * 2;
  const availH = sheetH - marginMm * 2;
  if (ticketW <= 0 || ticketH <= 0) return { rows: 0, cols: 0 };
  return {
    cols: Math.max(0, Math.floor(availW / ticketW)),
    rows: Math.max(0, Math.floor(availH / ticketH)),
  };
}

/** グリッド仕様(自動または手動)と用紙中央寄せの原点を返す */
export function resolveGrid(
  ticket: TicketSettings,
  sheet: SheetSettings
): GridSpec {
  const { w: sheetW, h: sheetH } = sheetSizeMm(sheet.paper, sheet.orientation);
  const auto = autoGrid(sheetW, sheetH, sheet.marginMm, ticket.widthMm, ticket.heightMm);
  const rows = sheet.manualGrid ? sheet.manualGrid.rows : auto.rows;
  const cols = sheet.manualGrid ? sheet.manualGrid.cols : auto.cols;
  const gridW = cols * ticket.widthMm;
  const gridH = rows * ticket.heightMm;
  return {
    rows,
    cols,
    originX: (sheetW - gridW) / 2,
    originY: (sheetH - gridH) / 2,
  };
}

/** シート内の各券の左上座標(mm)を行優先で返す */
export function ticketOrigins(grid: GridSpec, ticketW: number, ticketH: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      out.push({ x: grid.originX + c * ticketW, y: grid.originY + r * ticketH });
    }
  }
  return out;
}

/** 必要シート数(1シートあたり perSheet 枚) */
export function sheetsNeeded(ticketCount: number, perSheet: number): number {
  if (perSheet <= 0) return 0;
  return Math.ceil(ticketCount / perSheet);
}

/**
 * レイアウトの妥当性を検証し、日本語のエラーメッセージ配列を返す(空 = OK)。
 */
export function validateLayout(ticket: TicketSettings, sheet: SheetSettings): string[] {
  const errors: string[] = [];
  const { w: sheetW, h: sheetH } = sheetSizeMm(sheet.paper, sheet.orientation);
  const availW = sheetW - sheet.marginMm * 2;
  const availH = sheetH - sheet.marginMm * 2;

  if (ticket.widthMm <= 0 || ticket.heightMm <= 0) {
    errors.push("券のサイズは 1mm 以上を指定してください。");
    return errors;
  }
  if (sheet.marginMm < 0) {
    errors.push("余白は 0mm 以上を指定してください。");
  }
  if (ticket.stubEnabled && ticket.stubWidthMm >= ticket.widthMm - 10) {
    errors.push(
      `半券の幅(${ticket.stubWidthMm}mm)が大きすぎます。券の幅(${ticket.widthMm}mm)より 10mm 以上小さくしてください。`
    );
  }

  const auto = autoGrid(sheetW, sheetH, sheet.marginMm, ticket.widthMm, ticket.heightMm);
  if (auto.cols === 0 || auto.rows === 0) {
    errors.push(
      `券(${ticket.widthMm}×${ticket.heightMm}mm)が用紙の印刷可能領域(${availW.toFixed(0)}×${availH.toFixed(0)}mm)に収まりません。券サイズを小さくするか、用紙・余白を見直してください。`
    );
    return errors;
  }

  if (sheet.manualGrid) {
    const { rows, cols } = sheet.manualGrid;
    if (rows <= 0 || cols <= 0) {
      errors.push("行数・列数は 1 以上を指定してください。");
    } else if (cols * ticket.widthMm > availW || rows * ticket.heightMm > availH) {
      errors.push(
        `指定の ${rows}行×${cols}列(${(cols * ticket.widthMm).toFixed(0)}×${(rows * ticket.heightMm).toFixed(0)}mm)は印刷可能領域(${availW.toFixed(0)}×${availH.toFixed(0)}mm)に収まりません。自動計算では最大 ${auto.rows}行×${auto.cols}列です。`
      );
    }
  }
  return errors;
}
