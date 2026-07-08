import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { MM_TO_PT, resolveGrid, sheetSizeMm, sheetsNeeded, ticketOrigins } from "./geometry";
import { countInRange, formatTicketNumber, numbersForSheet } from "./numbering";
import { computeTicketLayout, formatPrice, type MeasureFn, type TicketLayout } from "./ticketLayout";
import { dataUrlToBytes, emojiToPngDataUrl } from "./images";
import type { NumberingSettings, Product, SheetSettings, TicketSettings } from "./types";

/** テキスト上端→ベースラインのおおよその比率(Noto Sans JP) */
const ASCENT_RATIO = 0.88;
const INK = rgb(0.1, 0.1, 0.12);
const GUIDE_GRAY = rgb(0.6, 0.6, 0.6);

export interface PdfJobInput {
  product: Product;
  ticket: TicketSettings;
  numbering: NumberingSettings;
  sheet: SheetSettings;
  startNumber: number;
  endNumber: number;
}

export interface PdfJobResult {
  bytes: Uint8Array;
  count: number;
  sheets: number;
}

// フォントは初回のみ fetch してキャッシュする
let fontBytesPromise: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;
function loadFontBytes() {
  fontBytesPromise ??= (async () => {
    const [regular, bold] = await Promise.all([
      fetch("/fonts/NotoSansJP-Regular.otf").then((r) => {
        if (!r.ok) throw new Error("日本語フォントの読み込みに失敗しました。");
        return r.arrayBuffer();
      }),
      fetch("/fonts/NotoSansJP-Bold.otf").then((r) => {
        if (!r.ok) throw new Error("日本語フォントの読み込みに失敗しました。");
        return r.arrayBuffer();
      }),
    ]);
    return { regular, bold };
  })();
  return fontBytesPromise;
}

/** mm座標(左上原点)→ PDF座標(左下原点、pt)変換ヘルパ */
function converters(sheetHMm: number) {
  return {
    x: (mm: number) => mm * MM_TO_PT,
    yTop: (mm: number) => (sheetHMm - mm) * MM_TO_PT, // 上端 y → PDF y
    len: (mm: number) => mm * MM_TO_PT,
  };
}

async function embedIllustration(
  doc: PDFDocument,
  product: Product
): Promise<PDFImage | null> {
  const ill = product.illustration;
  if (ill.kind === "none") return null;
  if (ill.kind === "emoji") {
    const dataUrl = emojiToPngDataUrl(ill.emoji);
    return doc.embedPng(dataUrlToBytes(dataUrl));
  }
  const bytes = dataUrlToBytes(ill.dataUrl);
  if (ill.dataUrl.startsWith("data:image/jpeg") || ill.dataUrl.startsWith("data:image/jpg")) {
    return doc.embedJpg(bytes);
  }
  return doc.embedPng(bytes);
}

function drawTicket(
  page: PDFPage,
  originMm: { x: number; y: number },
  layout: TicketLayout,
  fonts: { regular: PDFFont; bold: PDFFont },
  illustration: PDFImage | null,
  sheetHMm: number
) {
  const c = converters(sheetHMm);
  const ox = originMm.x;
  const oy = originMm.y;

  // 黒の枠線(券の端。隣の券と辺を共有する)
  page.drawRectangle({
    x: c.x(ox + layout.borderRect.x),
    y: c.yTop(oy + layout.borderRect.y + layout.borderRect.h),
    width: c.len(layout.borderRect.w),
    height: c.len(layout.borderRect.h),
    borderColor: INK,
    borderWidth: c.len(layout.borderWidthMm),
  });
  // ミシン目(半券境界、太めの点線)
  if (layout.perforationX !== null) {
    page.drawLine({
      start: { x: c.x(ox + layout.perforationX), y: c.yTop(oy + layout.perforationY.from) },
      end: { x: c.x(ox + layout.perforationX), y: c.yTop(oy + layout.perforationY.to) },
      thickness: c.len(0.8),
      color: INK,
      dashArray: [c.len(0.8), c.len(1.6)],
    });
  }
  // イラスト(領域内にアスペクト比を保って収める)
  if (illustration && layout.illustrationBox) {
    const box = layout.illustrationBox;
    const scale = Math.min(box.w / illustration.width, box.h / illustration.height);
    const wMm = illustration.width * scale;
    const hMm = illustration.height * scale;
    const xMm = ox + box.x + (box.w - wMm) / 2;
    const yMm = oy + box.y + (box.h - hMm) / 2;
    page.drawImage(illustration, {
      x: c.x(xMm),
      y: c.yTop(yMm + hMm),
      width: c.len(wMm),
      height: c.len(hMm),
    });
  }
  // テキスト
  for (const t of layout.texts) {
    page.drawText(t.text, {
      x: c.x(ox + t.xMm),
      y: c.yTop(oy + t.yTopMm + t.sizeMm * ASCENT_RATIO),
      size: t.sizeMm * MM_TO_PT,
      font: t.weight === "bold" ? fonts.bold : fonts.regular,
      color: t.color === "muted" ? rgb(0.45, 0.45, 0.45) : INK,
    });
  }
}

function drawCutGuides(
  page: PDFPage,
  ticket: TicketSettings,
  sheet: SheetSettings,
  sheetHMm: number
) {
  if (sheet.cutGuide === "none") return;
  const grid = resolveGrid(ticket, sheet);
  const c = converters(sheetHMm);
  const x0 = grid.originX;
  const y0 = grid.originY;
  const x1 = grid.originX + grid.cols * ticket.widthMm;
  const y1 = grid.originY + grid.rows * ticket.heightMm;

  if (sheet.cutGuide === "dashed") {
    const opts = {
      thickness: c.len(0.15),
      color: GUIDE_GRAY,
      dashArray: [c.len(2), c.len(1.5)],
    };
    for (let i = 0; i <= grid.cols; i++) {
      const x = x0 + i * ticket.widthMm;
      page.drawLine({ start: { x: c.x(x), y: c.yTop(y0) }, end: { x: c.x(x), y: c.yTop(y1) }, ...opts });
    }
    for (let j = 0; j <= grid.rows; j++) {
      const y = y0 + j * ticket.heightMm;
      page.drawLine({ start: { x: c.x(x0), y: c.yTop(y) }, end: { x: c.x(x1), y: c.yTop(y) }, ...opts });
    }
    return;
  }

  // トンボ: 各交点に十字マーク
  const ARM = 2.5; // 十字の腕の長さ(mm)
  const opts = { thickness: c.len(0.15), color: INK };
  for (let i = 0; i <= grid.cols; i++) {
    for (let j = 0; j <= grid.rows; j++) {
      const x = x0 + i * ticket.widthMm;
      const y = y0 + j * ticket.heightMm;
      page.drawLine({
        start: { x: c.x(x - ARM), y: c.yTop(y) },
        end: { x: c.x(x + ARM), y: c.yTop(y) },
        ...opts,
      });
      page.drawLine({
        start: { x: c.x(x), y: c.yTop(y - ARM) },
        end: { x: c.x(x), y: c.yTop(y + ARM) },
        ...opts,
      });
    }
  }
}

/**
 * 指定番号範囲の食券PDFを生成する。
 * プレビューと同じ computeTicketLayout / resolveGrid を使い、1mm = 2.8346pt で正確に変換する。
 */
export async function generateTicketsPdf(input: PdfJobInput): Promise<PdfJobResult> {
  const { product, ticket, numbering, sheet, startNumber, endNumber } = input;
  const { w: sheetW, h: sheetH } = sheetSizeMm(sheet.paper, sheet.orientation);
  const grid = resolveGrid(ticket, sheet);
  const perSheet = grid.rows * grid.cols;
  const count = countInRange(startNumber, endNumber);
  const sheets = sheetsNeeded(count, perSheet);
  if (perSheet === 0) throw new Error("券が用紙に収まりません。設定を見直してください。");
  if (count === 0) throw new Error("番号範囲が不正です。");

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
  const [regular, bold] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: true }),
    doc.embedFont(bytes.bold, { subset: true }),
  ]);
  const fonts = { regular, bold };

  // フィッティング測定は太字(幅が広い方)で行い、プレビュー側と揃える
  const measure: MeasureFn = (text, sizeMm) =>
    bold.widthOfTextAtSize(text, sizeMm * MM_TO_PT) / MM_TO_PT;

  const illustration = await embedIllustration(doc, product);
  const origins = ticketOrigins(grid, ticket.widthMm, ticket.heightMm);
  const priceText = formatPrice(product.price);

  doc.setTitle(`食券 ${product.name}`);

  for (let s = 0; s < sheets; s++) {
    const page = doc.addPage([sheetW * MM_TO_PT, sheetH * MM_TO_PT]);
    drawCutGuides(page, ticket, sheet, sheetH);
    const numbers = numbersForSheet(startNumber, endNumber, perSheet, s);
    numbers.forEach((n, i) => {
      const layout = computeTicketLayout(
        ticket,
        {
          name: product.name,
          priceText,
          numberText: formatTicketNumber(numbering, n),
          illustration: product.illustration,
        },
        measure
      );
      drawTicket(page, origins[i], layout, fonts, illustration, sheetH);
    });
  }

  return { bytes: await doc.save(), count, sheets };
}

/** 生成したPDFをダウンロードさせる */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
