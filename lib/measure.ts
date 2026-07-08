import type { MeasureFn } from "./ticketLayout";

/**
 * プレビュー用: canvas.measureText によるテキスト幅測定(mm)。
 * 券面表示と同じ "Ticket JP"(= public/fonts の Noto Sans JP)で測る。
 * 太字の方が幅が広いため、常に太字で測って安全側に倒す(PDF側も同様)。
 */
export function createCanvasMeasure(): MeasureFn {
  let ctx: CanvasRenderingContext2D | null = null;
  const PX_PER_MM = 10; // 測定精度用の拡大率
  return (text, sizeMm) => {
    if (typeof document === "undefined") return text.length * sizeMm; // SSR時の概算
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return text.length * sizeMm; // 予防的フォールバック
    ctx.font = `700 ${sizeMm * PX_PER_MM}px "Ticket JP", sans-serif`;
    return ctx.measureText(text).width / PX_PER_MM;
  };
}
