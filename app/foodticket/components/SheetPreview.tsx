"use client";

import { useEffect, useRef, useState } from "react";
import { columnEdges, resolveGrid, rowEdges, sheetSizeMm, ticketOrigins, validateLayout } from "@/lib/geometry";
import { formatTicketNumber, numbersForSheet } from "@/lib/numbering";
import type { AppState, Product } from "@/lib/types";
import { TicketView } from "./TicketView";
import { ErrorList } from "@/app/components/ui";

const PAPER_LABEL = { A4: "A4", B5: "B5", A3: "A3" } as const;

/**
 * 1シート目の実寸比プレビュー。グリッド・切り取りガイドの描画位置は
 * PDF と同じ resolveGrid / ticketOrigins を使う。
 */
export function SheetPreview({
  state,
  product,
  startNumber,
  endNumber,
  fontTick,
}: {
  state: AppState;
  product: Product | null;
  startNumber: number;
  endNumber: number;
  fontTick: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { ticket, sheet, numbering } = state;
  const { w: sheetW, h: sheetH } = sheetSizeMm(sheet.paper, sheet.orientation);
  const errors = validateLayout(ticket, sheet);
  const grid = resolveGrid(ticket, sheet);
  const perSheet = grid.rows * grid.cols;
  const scale = containerW > 0 ? containerW / sheetW : 0;
  const px = (mm: number) => mm * scale;

  const origins = ticketOrigins(grid, ticket.widthMm, ticket.heightMm, sheet.gapMm);
  const numbers =
    perSheet > 0 && endNumber >= startNumber
      ? numbersForSheet(startNumber, endNumber, perSheet, 0)
      : [];

  const xEdges = columnEdges(grid, ticket.widthMm, sheet.gapMm);
  const yEdges = rowEdges(grid, ticket.heightMm, sheet.gapMm);
  const gridX0 = xEdges[0] ?? grid.originX;
  const gridX1 = xEdges[xEdges.length - 1] ?? grid.originX;
  const gridY0 = yEdges[0] ?? grid.originY;
  const gridY1 = yEdges[yEdges.length - 1] ?? grid.originY;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-700">プレビュー(1シート目)</h2>
        <p className="text-xs text-slate-500">
          {PAPER_LABEL[sheet.paper]}
          {sheet.orientation === "portrait" ? "縦" : "横"} / {grid.rows}行×{grid.cols}列 ={" "}
          {perSheet}枚/シート
          {sheet.manualGrid ? "(手動指定)" : "(自動計算)"}
        </p>
      </div>

      <ErrorList errors={errors} />

      <div ref={containerRef} className="w-full">
        {scale > 0 && (
          <div
            className="relative bg-white shadow-md mx-auto overflow-hidden"
            style={{ width: px(sheetW), height: px(sheetH) }}
          >
            {/* 余白の目安(印刷可能領域) */}
            <div
              className="absolute border border-slate-100"
              style={{
                left: px(sheet.marginMm),
                top: px(sheet.marginMm),
                width: px(sheetW - sheet.marginMm * 2),
                height: px(sheetH - sheet.marginMm * 2),
              }}
            />
            {/* 切り取りガイド */}
            {perSheet > 0 &&
              sheet.cutGuide === "dashed" &&
              xEdges.map((x, i) => (
                <div
                  key={`v${i}`}
                  className="absolute border-l border-dashed border-slate-400"
                  style={{
                    left: px(x),
                    top: px(gridY0),
                    height: px(gridY1 - gridY0),
                  }}
                />
              ))}
            {perSheet > 0 &&
              sheet.cutGuide === "dashed" &&
              yEdges.map((y, i) => (
                <div
                  key={`h${i}`}
                  className="absolute border-t border-dashed border-slate-400"
                  style={{
                    left: px(gridX0),
                    top: px(y),
                    width: px(gridX1 - gridX0),
                  }}
                />
              ))}
            {perSheet > 0 &&
              sheet.cutGuide === "crop" &&
              xEdges.flatMap((x, i) =>
                yEdges.map((y, j) => (
                  <span key={`c${i}-${j}`}>
                    <span
                      className="absolute bg-slate-700"
                      style={{ left: px(x - 2.5), top: px(y), width: px(5), height: 1 }}
                    />
                    <span
                      className="absolute bg-slate-700"
                      style={{ left: px(x), top: px(y - 2.5), width: 1, height: px(5) }}
                    />
                  </span>
                ))
              )}
            {/* 券 */}
            {product &&
              numbers.map((n, i) => (
                <div
                  key={n}
                  className="absolute"
                  style={{ left: px(origins[i].x), top: px(origins[i].y) }}
                >
                  <TicketView
                    ticket={ticket}
                    product={product}
                    numberText={formatTicketNumber(numbering, n)}
                    numberOrientation={numbering.orientation}
                    scale={scale}
                    fontTick={fontTick}
                  />
                </div>
              ))}
            {!product && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                商品を選択してください
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        ※ PDFを「実際のサイズ」(倍率100%)で印刷すると、券は指定した mm 寸法どおりに
        仕上がります。
      </p>
    </div>
  );
}
