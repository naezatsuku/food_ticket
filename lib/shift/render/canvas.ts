import type { ShiftProject } from "../types";

export interface CanvasExportOptions {
  title: string;
  subtitle?: string;
  /** 出力対象の日付("YYYY-MM-DD")。日付を跨ぐプロジェクトでは1日ずつ出力する */
  date: string;
  /** devicePixelRatio 相当の倍率(2〜3を推奨) */
  scale?: number;
  background: "white" | "transparent";
}

const PADDING = 16;
const TITLE_HEIGHT = 32;
const SUBTITLE_HEIGHT = 20;
const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 26;
const TIME_COL_WIDTH = 92;
const ROLE_COL_WIDTH = 150;
const LEGEND_ROW_HEIGHT = 22;
/** 凡例の折り返し見積もりに使う、1行あたりの想定役割数(実際の描画時は文字幅で折り返す) */
const LEGEND_ITEMS_PER_ROW_ESTIMATE = 3;

/** キャンバスの表示サイズ(CSSピクセル、devicePixelRatio適用前)を計算する */
export function computeCanvasSize(
  project: ShiftProject,
  options: Pick<CanvasExportOptions, "subtitle" | "date">
): { width: number; height: number } {
  const roleCount = Math.max(1, project.roles.length);
  const slotCount = Math.max(1, project.slots.filter((s) => s.date === options.date).length);
  const legendRows = Math.max(1, Math.ceil(project.roles.length / LEGEND_ITEMS_PER_ROW_ESTIMATE));

  const width = PADDING * 2 + TIME_COL_WIDTH + roleCount * ROLE_COL_WIDTH;
  const height =
    PADDING * 2 +
    TITLE_HEIGHT +
    (options.subtitle ? SUBTITLE_HEIGHT : 0) +
    HEADER_HEIGHT +
    slotCount * ROW_HEIGHT +
    legendRows * LEGEND_ROW_HEIGHT;

  return { width, height };
}

/**
 * シフト表を Canvas に直接描画する(html2canvas 等の DOM 変換は使わない)。
 * devicePixelRatio 相当の倍率でバッキングストアを確保し、高精細な PNG を出力できるようにする。
 */
export function renderScheduleToCanvas(
  canvas: HTMLCanvasElement,
  project: ShiftProject,
  options: CanvasExportOptions
): void {
  const scale = options.scale ?? 2;
  const { width, height } = computeCanvasSize(project, options);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  if (options.background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  const personById = new Map(project.people.map((p) => [p.id, p]));
  const slots = project.slots
    .filter((s) => s.date === options.date)
    .sort((a, b) => a.start.localeCompare(b.start));

  ctx.textBaseline = "top";

  let y = PADDING;
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(options.title || "シフト表", PADDING, y);
  y += TITLE_HEIGHT;

  if (options.subtitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(options.subtitle, PADDING, y);
    y += SUBTITLE_HEIGHT;
  }

  const gridLeft = PADDING;
  const gridTop = y;
  const gridWidth = TIME_COL_WIDTH + project.roles.length * ROLE_COL_WIDTH;

  // ヘッダ行(役割名 + 色)
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(gridLeft, gridTop, gridWidth, HEADER_HEIGHT);
  project.roles.forEach((role, i) => {
    const x = gridLeft + TIME_COL_WIDTH + i * ROLE_COL_WIDTH;
    ctx.fillStyle = role.colorHex;
    ctx.beginPath();
    ctx.arc(x + 10, gridTop + HEADER_HEIGHT / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(role.name || "無題", x + 20, gridTop + 8, ROLE_COL_WIDTH - 24);
  });

  // 各行(枠 × 役割)
  slots.forEach((slot, rowIndex) => {
    const rowY = gridTop + HEADER_HEIGHT + rowIndex * ROW_HEIGHT;
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(gridLeft, rowY, gridWidth, ROW_HEIGHT);

    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText(`${slot.start}〜${slot.end}`, gridLeft + 6, rowY + 7, TIME_COL_WIDTH - 10);

    project.roles.forEach((role, colIndex) => {
      const x = gridLeft + TIME_COL_WIDTH + colIndex * ROLE_COL_WIDTH;
      ctx.strokeRect(x, rowY, ROLE_COL_WIDTH, ROW_HEIGHT);
      const names = project.assignments
        .filter((a) => a.slotId === slot.id && a.roleId === role.id)
        .map((a) => personById.get(a.personId)?.name ?? a.personId)
        .join("、");
      ctx.fillStyle = "#0f172a";
      ctx.font = "11px sans-serif";
      ctx.fillText(names, x + 6, rowY + 7, ROLE_COL_WIDTH - 12);
    });
  });

  // 凡例(役割名の色分け一覧)
  let legendX = gridLeft;
  let legendY = gridTop + HEADER_HEIGHT + slots.length * ROW_HEIGHT + 6;
  ctx.font = "11px sans-serif";
  const maxLegendWidth = gridLeft + gridWidth;
  project.roles.forEach((role) => {
    const label = role.name || "無題";
    const itemWidth = ctx.measureText(label).width + 24;
    if (legendX + itemWidth > maxLegendWidth && legendX > gridLeft) {
      legendX = gridLeft;
      legendY += LEGEND_ROW_HEIGHT;
    }
    ctx.fillStyle = role.colorHex;
    ctx.beginPath();
    ctx.arc(legendX + 5, legendY + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.fillText(label, legendX + 14, legendY);
    legendX += itemWidth;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type));
}
