import { computeTicketLayout } from "./lib/ticketLayout";
import type { TicketSettings } from "./lib/types";

function measure(text: string, sizeMm: number): number {
  let w = 0;
  for (const ch of text) {
    const isWide = ch.codePointAt(0)! > 0xff;
    w += sizeMm * (isWide ? 0.98 : 0.58);
  }
  return w;
}

const cases: { label: string; ticket: TicketSettings; name: string; price: string }[] = [
  {
    label: "デフォルト(90x50, stub25) + イラスト, 短い商品名",
    ticket: { widthMm: 90, heightMm: 50, stubEnabled: true, stubWidthMm: 25, borderWidthMm: 0.5 },
    name: "からあげ弁当",
    price: "¥500",
  },
  {
    label: "デフォルト(90x50, stub25) + イラスト, やや長い商品名",
    ticket: { widthMm: 90, heightMm: 50, stubEnabled: true, stubWidthMm: 25, borderWidthMm: 0.5 },
    name: "スペシャル唐揚げ弁当",
    price: "¥500",
  },
  {
    label: "デフォルト(90x50, stub25) + イラスト, 長い商品名",
    ticket: { widthMm: 90, heightMm: 50, stubEnabled: true, stubWidthMm: 25, borderWidthMm: 0.5 },
    name: "スペシャルもりもり特製から揚げ弁当",
    price: "¥1,000",
  },
  {
    label: "半券なし(90x50) + イラスト, 長い商品名",
    ticket: { widthMm: 90, heightMm: 50, stubEnabled: false, stubWidthMm: 25, borderWidthMm: 0.5 },
    name: "スペシャルもりもり特製から揚げ弁当",
    price: "¥1,000",
  },
  {
    label: "小さめの券(70x40, stub20) + イラスト, とても長い商品名",
    ticket: { widthMm: 70, heightMm: 40, stubEnabled: true, stubWidthMm: 20, borderWidthMm: 0.5 },
    name: "スペシャルもりもり特製から揚げ弁当プレート大盛り",
    price: "¥1,200",
  },
];

for (const c of cases) {
  console.log("=== " + c.label + " ===");
  const layout = computeTicketLayout(
    c.ticket,
    { name: c.name, priceText: c.price, numberText: "No.0001", illustration: { kind: "emoji", emoji: "🍛" } },
    measure
  );
  console.log("illustrationBox:", layout.illustrationBox);
  const boxes = layout.texts.map((t) => {
    const w = measure(t.text, t.sizeMm);
    // CSS 側は lineHeight:1 で描画するため、実際のインクの高さは概ね sizeMm
    return { text: t.text, x0: t.xMm, x1: t.xMm + w, y0: t.yTopMm, y1: t.yTopMm + t.sizeMm, size: t.sizeMm };
  });
  for (const b of boxes) {
    console.log(
      `  "${b.text}" size=${b.size.toFixed(2)} x=[${b.x0.toFixed(1)}, ${b.x1.toFixed(1)}] y=[${b.y0.toFixed(1)}, ${b.y1.toFixed(1)}]`
    );
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const xOverlap = a.x0 < b.x1 && b.x0 < a.x1;
      const yOverlap = a.y0 < b.y1 && b.y0 < a.y1;
      if (xOverlap && yOverlap) {
        console.log(`  !!! TEXT OVERLAP: "${a.text}" vs "${b.text}"`);
      }
    }
  }
  if (layout.illustrationBox) {
    const ib = layout.illustrationBox;
    for (const b of boxes) {
      const xOverlap = b.x0 < ib.x + ib.w && ib.x < b.x1;
      const yOverlap = b.y0 < ib.y + ib.h && ib.y < b.y1;
      if (xOverlap && yOverlap) {
        console.log(`  !!! TEXT/ILLUSTRATION OVERLAP: "${b.text}"`);
      }
    }
  }
  console.log();
}
