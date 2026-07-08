import { describe, expect, it } from "vitest";
import {
  computeTicketLayout,
  fitFontSize,
  fitWrappedText,
  formatPrice,
  LINE_HEIGHT,
  wrapText,
  type MeasureFn,
} from "../ticketLayout";
import type { TicketSettings } from "../types";

/** 疑似メジャラー: 1文字 = サイズ×0.9mm 幅とみなす */
const fakeMeasure: MeasureFn = (text, sizeMm) => text.length * sizeMm * 0.9;

const baseTicket: TicketSettings = {
  widthMm: 90,
  heightMm: 50,
  stubEnabled: false,
  stubWidthMm: 25,
};

describe("fitFontSize", () => {
  it("収まる場合は最大サイズを返す", () => {
    expect(fitFontSize(fakeMeasure, "abc", 100, 8, 3)).toBe(8);
  });
  it("長いテキストは縮小される", () => {
    const size = fitFontSize(fakeMeasure, "とてもながいしょうひんめい", 40, 8, 3);
    expect(size).toBeLessThan(8);
    expect(fakeMeasure("とてもながいしょうひんめい", size)).toBeLessThanOrEqual(40);
  });
  it("最小サイズでも収まらない場合は最小サイズを返す", () => {
    expect(fitFontSize(fakeMeasure, "x".repeat(100), 10, 8, 3)).toBe(3);
  });
});

describe("wrapText", () => {
  it("収まる場合は1行のまま", () => {
    expect(wrapText(fakeMeasure, "abc", 100, 8)).toEqual(["abc"]);
  });
  it("収まらない場合は文字単位で改行し、各行が幅内に収まる", () => {
    const lines = wrapText(fakeMeasure, "とてもながいしょうひんめい", 20, 5);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("とてもながいしょうひんめい");
    for (const line of lines) {
      expect(fakeMeasure(line, 5)).toBeLessThanOrEqual(20);
    }
  });
});

describe("fitWrappedText", () => {
  it("1行で収まるならそのまま最大サイズ", () => {
    const r = fitWrappedText(fakeMeasure, "abc", 100, 20, 8, 3);
    expect(r.sizeMm).toBe(8);
    expect(r.lines).toEqual(["abc"]);
  });
  it("幅に収まらなければ改行され、高さにも収まるサイズが選ばれる", () => {
    const r = fitWrappedText(fakeMeasure, "とてもながいしょうひんめい", 30, 20, 8, 3);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join("")).toBe("とてもながいしょうひんめい");
    expect(r.lines.length * r.sizeMm * LINE_HEIGHT).toBeLessThanOrEqual(20);
  });
  it("maxSizeMm が minSizeMm を下回っても null を返さない", () => {
    const r = fitWrappedText(fakeMeasure, "カレーライス", 30, 20, 2, 3);
    expect(r).not.toBeNull();
    expect(r.sizeMm).toBe(2);
    expect(r.lines.join("")).toBe("カレーライス");
  });
});

describe("formatPrice", () => {
  it("桁区切りと¥を付与", () => {
    expect(formatPrice(500)).toBe("¥500");
    expect(formatPrice(10000)).toBe("¥10,000");
  });
  it("0円は¥0", () => {
    expect(formatPrice(0)).toBe("¥0");
  });
  it("nullは空欄", () => {
    expect(formatPrice(null)).toBe("");
  });
});

describe("computeTicketLayout", () => {
  const content = {
    name: "カレーライス",
    priceText: "¥500",
    numberText: "No.0001",
    illustration: { kind: "none" } as const,
  };

  it("半券なし: ミシン目なし、番号・商品名・値段が含まれる", () => {
    const layout = computeTicketLayout(baseTicket, content, fakeMeasure);
    expect(layout.perforationX).toBeNull();
    const textStrings = layout.texts.map((t) => t.text);
    expect(textStrings).toContain("No.0001");
    expect(textStrings).toContain("カレーライス");
    expect(textStrings).toContain("¥500");
  });

  it("半券あり: ミシン目位置が半券幅、番号が両側に印字される", () => {
    const layout = computeTicketLayout(
      { ...baseTicket, stubEnabled: true },
      content,
      fakeMeasure
    );
    expect(layout.perforationX).toBe(25);
    const numbers = layout.texts.filter((t) => t.text === "No.0001");
    expect(numbers).toHaveLength(2);
    // 片方は半券内(x < 25)、もう片方は本券側
    expect(numbers.some((t) => t.xMm < 25)).toBe(true);
    expect(numbers.some((t) => t.xMm > 25)).toBe(true);
  });

  it("すべての要素が券内に収まる", () => {
    const layout = computeTicketLayout(
      { ...baseTicket, stubEnabled: true },
      { ...content, name: "スペシャルもりもり特製カレーライス大盛り", priceText: "¥10,000" },
      fakeMeasure
    );
    for (const t of layout.texts) {
      expect(t.xMm).toBeGreaterThanOrEqual(0);
      expect(t.yTopMm).toBeGreaterThanOrEqual(0);
      expect(t.yTopMm + t.sizeMm).toBeLessThanOrEqual(50);
      expect(t.xMm + fakeMeasure(t.text, t.sizeMm)).toBeLessThanOrEqual(90 + 0.01);
    }
  });

  it("長い商品名は縮小しきる前に改行される", () => {
    const layout = computeTicketLayout(
      baseTicket,
      { ...content, name: "スペシャルもりもり特製カレーライス大盛り" },
      fakeMeasure
    );
    const nameLines = layout.texts.filter((t) => t.weight === "bold" && t.text !== "¥500");
    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.map((t) => t.text).join("")).toBe(
      "スペシャルもりもり特製カレーライス大盛り"
    );
    // 各行が本券のテキスト幅に収まる
    for (const t of nameLines) {
      expect(t.xMm + fakeMeasure(t.text, t.sizeMm)).toBeLessThanOrEqual(90 - 3 + 0.01);
    }
  });

  it("イラストありの場合は右側に領域が確保され、テキストと重ならない", () => {
    const layout = computeTicketLayout(
      baseTicket,
      { ...content, illustration: { kind: "emoji", emoji: "🍛" } },
      fakeMeasure
    );
    expect(layout.illustrationBox).not.toBeNull();
    const box = layout.illustrationBox!;
    expect(box.x + box.w).toBeLessThanOrEqual(90);
    for (const t of layout.texts) {
      expect(t.xMm + fakeMeasure(t.text, t.sizeMm)).toBeLessThanOrEqual(box.x);
    }
  });

  it("枠線は券の端ちょうど(隣の券と隙間なく並ぶ)", () => {
    const layout = computeTicketLayout(baseTicket, content, fakeMeasure);
    expect(layout.borderRect).toEqual({ x: 0, y: 0, w: 90, h: 50 });
    expect(layout.perforationY).toEqual({ from: 1.5, to: 48.5 });
  });

  it("券の高さが低く商品名の最大サイズが最小サイズを下回ってもクラッシュしない", () => {
    // heightMm=15 のとき largeTextMax(=min(h*0.16, 8.5)=2.4) が
    // fitWrappedText の minSizeMm(=3) を下回るケース
    expect(() =>
      computeTicketLayout({ ...baseTicket, heightMm: 15 }, content, fakeMeasure)
    ).not.toThrow();
  });
});
