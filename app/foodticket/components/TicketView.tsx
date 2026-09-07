"use client";

import { useMemo } from "react";
import { createCanvasMeasure } from "@/lib/measure";
import { computeTicketLayout, formatPrice } from "@/lib/ticketLayout";
import type { Product, TicketSettings } from "@/lib/types";

const measure = createCanvasMeasure();

const INK = "#1a1a1f";

/**
 * 券1枚のプレビュー。computeTicketLayout の結果(PDFと共通)をそのまま描く。
 * 装飾は黒一色・立体感なし。
 * scale = px/mm。fontTick はフォント読み込み完了時に再計測させるためのカウンタ。
 */
export function TicketView({
  ticket,
  product,
  numberText,
  stubNumberOrientation,
  mainNumberOrientation,
  scale,
  fontTick,
}: {
  ticket: TicketSettings;
  product: Product;
  numberText: string;
  stubNumberOrientation: "horizontal" | "vertical";
  mainNumberOrientation: "horizontal" | "vertical";
  scale: number;
  fontTick: number;
}) {
  const layout = useMemo(
    () =>
      computeTicketLayout(
        ticket,
        {
          name: product.name,
          priceText: formatPrice(product.price),
          numberText,
          illustration: product.illustration,
          stubNumberOrientation,
          mainNumberOrientation,
        },
        measure
      ),
    // fontTick はフォントロード後の再計測トリガー
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ticket,
      product.name,
      product.price,
      product.illustration,
      numberText,
      stubNumberOrientation,
      mainNumberOrientation,
      fontTick,
    ]
  );
  const px = (mm: number) => mm * scale;

  return (
    <div
      className="relative bg-white overflow-hidden"
      style={{ width: px(layout.widthMm), height: px(layout.heightMm) }}
    >
      {/* 黒の枠線(券の端。隣の券と共有し、隙間なく並ぶ) */}
      <div
        className="absolute"
        style={{
          left: px(layout.borderRect.x),
          top: px(layout.borderRect.y),
          width: px(layout.borderRect.w),
          height: px(layout.borderRect.h),
          border: `${Math.max(2, px(layout.borderWidthMm))}px solid ${INK}`,
        }}
      />
      {/* ミシン目(太めの点線) */}
      {layout.perforationX !== null && (
        <div
          className="absolute"
          style={{
            left: px(layout.perforationX) - Math.max(1, px(0.8)) / 2,
            top: px(layout.perforationY.from),
            height: px(layout.perforationY.to - layout.perforationY.from),
            borderLeft: `${Math.max(1, px(0.8))}px dotted ${INK}`,
          }}
        />
      )}
      {/* イラスト(本券の右側) */}
      {layout.illustrationBox && product.illustration.kind === "emoji" && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: px(layout.illustrationBox.x),
            top: px(layout.illustrationBox.y),
            width: px(layout.illustrationBox.w),
            height: px(layout.illustrationBox.h),
            fontSize: px(layout.illustrationBox.h) * 0.8,
            lineHeight: 1,
          }}
        >
          {product.illustration.emoji}
        </div>
      )}
      {layout.illustrationBox && product.illustration.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.illustration.dataUrl}
          alt=""
          className="absolute object-contain"
          style={{
            left: px(layout.illustrationBox.x),
            top: px(layout.illustrationBox.y),
            width: px(layout.illustrationBox.w),
            height: px(layout.illustrationBox.h),
          }}
        />
      )}
      {/* テキスト */}
      {layout.texts.map((t, i) => (
        <span
          key={i}
          className="absolute whitespace-nowrap"
          style={{
            // 回転時は、回転後に見た目の左上が (t.xMm, t.yTopMm) に来るよう
            // 回転前の基準点を右に t.sizeMm 分ずらしておく(左上を軸に時計回り90度回転)
            left: px(t.rotated ? t.xMm + t.sizeMm : t.xMm),
            top: px(t.yTopMm),
            fontSize: px(t.sizeMm),
            lineHeight: 1,
            fontWeight: t.weight === "bold" ? 700 : 400,
            fontFamily: '"Ticket JP", sans-serif',
            color: t.color === "muted" ? "#737373" : INK,
            transform: t.rotated ? "rotate(90deg)" : undefined,
            transformOrigin: t.rotated ? "0 0" : undefined,
          }}
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}
