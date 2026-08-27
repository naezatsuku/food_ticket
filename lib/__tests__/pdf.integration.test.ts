/**
 * PDF生成の統合テスト(Node環境)。
 * ブラウザの fetch("/fonts/...") をローカルファイル読み込みに差し替えて実行する。
 * 仕様書の最終確認手順「A4縦・90×50mm・4桁・No.0001〜No.0040」を再現し、
 * 生成物を test-output/ に保存する(目視確認用)。
 */
import { readFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { generateTicketsPdf } from "../pdf";
import { defaultAppState } from "../types";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const file = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    const buf = await readFile(file);
    return {
      ok: true,
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    };
  });
});

describe("generateTicketsPdf(統合)", () => {
  it("A4縦・90×50mm・4桁・No.0001〜0040 → 4ページのPDFが正しい寸法で生成される", async () => {
    const d = defaultAppState();
    const ticket: typeof d.ticket = {
      widthMm: 90,
      heightMm: 50,
      stubEnabled: true,
      stubWidthMm: 25,
    };
    const sheet: typeof d.sheet = {
      paper: "A4",
      orientation: "portrait",
      marginMm: 10,
      cutGuide: "dashed",
      manualGrid: null,
    };
    const result = await generateTicketsPdf({
      product: {
        ...d.products[0],
        name: "カレーライス",
        price: 500,
        illustration: { kind: "image", dataUrl: TINY_PNG },
      },
      ticket, // 90×50mm・半券あり
      numbering: { prefix: "No.", digits: 4 },
      sheet, // A4縦・余白10mm・破線ガイド
      startNumber: 1,
      endNumber: 40,
    });

    expect(result.count).toBe(40);
    // 2列×5行 = 10枚/シート → 4シート
    expect(result.sheets).toBe(4);

    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(4);
    const { width, height } = doc.getPage(0).getSize();
    // A4 = 210×297mm = 595.28×841.89pt(1mm = 2.8346pt)
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);

    const outDir = path.join(process.cwd(), "test-output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "食券_カレーライス_0001-0040.pdf"), result.bytes);
  });

  it("長い商品名・高額(¥10,000)・半券なしでもエラーなく生成できる", async () => {
    const d = defaultAppState();
    const result = await generateTicketsPdf({
      product: {
        ...d.products[0],
        name: "スペシャルもりもり特製カレーライス大盛り",
        price: 10000,
        illustration: { kind: "none" },
      },
      ticket: { ...d.ticket, stubEnabled: false },
      numbering: { prefix: "No.", digits: 5 },
      sheet: { ...d.sheet, paper: "B5", orientation: "landscape", cutGuide: "crop" },
      startNumber: 990,
      endNumber: 1005,
    });
    expect(result.count).toBe(16);
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
    const outDir = path.join(process.cwd(), "test-output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "食券_長い商品名_B5横.pdf"), result.bytes);
  });

  it("券が用紙に収まらない場合は日本語エラー", async () => {
    const d = defaultAppState();
    await expect(
      generateTicketsPdf({
        product: d.products[0],
        ticket: { ...d.ticket, widthMm: 300 },
        numbering: d.numbering,
        sheet: d.sheet,
        startNumber: 1,
        endNumber: 10,
      })
    ).rejects.toThrow("収まりません");
  });
});
