import type { Illustration, TicketSettings } from "./types";

/**
 * テキスト幅の測定関数。sizeMm のフォントで text を描いたときの幅を mm で返す。
 * プレビューは canvas.measureText、PDF は pdf-lib の widthOfTextAtSize を注入する。
 */
export type MeasureFn = (text: string, sizeMm: number) => number;

export interface TextElement {
  text: string;
  /** 左端の x 座標(mm、券の左上原点) */
  xMm: number;
  /** テキストボックス上端の y 座標(mm) */
  yTopMm: number;
  sizeMm: number;
  weight: "regular" | "bold";
  /** "ink" = 黒、"muted" = グレー */
  color: "ink" | "muted";
}

export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 券1枚のレイアウト��算結果(mm 座標、券の左上原点)。プレビューと PDF が共有する */
export interface TicketLayout {
  widthMm: number;
  heightMm: number;
  texts: TextElement[];
  /** 黒の枠線(券の端ちょうど。隣接する券と共有され、切り取り線を兼ねる) */
  borderRect: RectMm;
  /** 枠線の太さ(mm) */
  borderWidthMm: number;
  /** ミシン目(半券境界)の x 座標。半券なしなら null */
  perforationX: number | null;
  /** ミシン目の y 範囲(mm) */
  perforationY: { from: number; to: number };
  /** イラスト描画領域。イラストなしなら null */
  illustrationBox: RectMm | null;
}

/**
 * maxSizeMm から 0.25mm 刻みで縮小し、maxWidthMm に収まるフォントサイズを返す。
 * minSizeMm でも収まらない場合は minSizeMm を返す(はみ出しより縮小を優先)。
 */
export function fitFontSize(
  measure: MeasureFn,
  text: string,
  maxWidthMm: number,
  maxSizeMm: number,
  minSizeMm: number
): number {
  if (text === "") return maxSizeMm;
  for (let size = maxSizeMm; size >= minSizeMm; size -= 0.25) {
    if (measure(text, size) <= maxWidthMm) return size;
  }
  return minSizeMm;
}

/** 行送り(フォントサイズに対する倍率) */
export const LINE_HEIGHT = 1.15;

/**
 * text を maxWidthMm に収まるよう文字単位で改行し、行の配列を返す。
 * 日本語は単語区切りがないため貪欲に1文字ずつ詰める。
 */
export function wrapText(
  measure: MeasureFn,
  text: string,
  maxWidthMm: number,
  sizeMm: number
): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    const next = cur + ch;
    if (cur !== "" && measure(next, sizeMm) > maxWidthMm) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

export interface WrappedText {
  sizeMm: number;
  lines: string[];
}

/**
 * 枠(maxWidthMm × maxHeightMm)に収まるフォントサイズと改行位置を決める。
 * まず1行で収まる最大サイズを探し、収まらなければ改行しながら縮小する。
 * minSizeMm まで縮小しても収まらない場合は minSizeMm で改行した結果を返す。
 */
export function fitWrappedText(
  measure: MeasureFn,
  text: string,
  maxWidthMm: number,
  maxHeightMm: number,
  maxSizeMm: number,
  minSizeMm: number
): WrappedText {
  if (text === "") return { sizeMm: maxSizeMm, lines: [] };
  // maxSizeMm が minSizeMm を下回る(券が小さすぎる等)場合、ループが一度も回らず
  // best が null のままになるので、その場合は maxSizeMm 単体で改行して返す
  if (maxSizeMm < minSizeMm) {
    return { sizeMm: maxSizeMm, lines: wrapText(measure, text, maxWidthMm, maxSizeMm) };
  }
  let best: WrappedText | null = null;
  for (let size = maxSizeMm; size >= minSizeMm; size -= 0.25) {
    const lines = wrapText(measure, text, maxWidthMm, size);
    best = { sizeMm: size, lines };
    if (lines.length * size * LINE_HEIGHT <= maxHeightMm) return best;
  }
  return best!;
}

/** 値段の表示文字列(null = 空欄)。桁区切りあり、「¥」を付与 */
export function formatPrice(price: number | null): string {
  if (price === null) return "";
  return "¥" + price.toLocaleString("ja-JP");
}

export interface TicketContent {
  name: string;
  priceText: string;
  numberText: string;
  illustration: Illustration;
}

const PAD = 3; // 券内の基本パディング(mm)
const BORDER_W = 0.5; // 枠線の太さ(mm、印刷時は画面プレビューで最低2px相当になるよう別途下限あり)
const NUMBER_SIZE = 2.2; // 番号のフォントサイズ(mm。商品名・値段より控えめに)

/**
 * 券1枚分のレイアウトを計算する純粋関数。
 * プレビュー(HTML)と PDF 描画の両方がこの結果をそのまま描く。
 * 装飾はすべて黒一色(枠線・ミシン目・テキスト)。
 */
export function computeTicketLayout(
  ticket: TicketSettings,
  content: TicketContent,
  measure: MeasureFn
): TicketLayout {
  const w = ticket.widthMm;
  const h = ticket.heightMm;
  const texts: TextElement[] = [];

  // 枠線は券の端ちょうど。隣の券と辺を共有するので券同士の隙間はゼロ
  const borderRect: RectMm = { x: 0, y: 0, w, h };
  const contentBottom = h - PAD; // テキストを置ける下限

  const stub = ticket.stubEnabled;
  const stubW = stub ? ticket.stubWidthMm : 0;
  const perforationX = stub ? stubW : null;

  // ---- 半券(左側) ----
  if (stub) {
    const stubInnerW = stubW - PAD * 2;
    texts.push({
      text: content.numberText,
      xMm: PAD,
      yTopMm: PAD,
      sizeMm: fitFontSize(measure, content.numberText, stubInnerW, NUMBER_SIZE, 1.5),
      weight: "regular",
      color: "ink",
    });
    if (content.name) {
      const nameTop = PAD + NUMBER_SIZE + 2;
      const fitted = fitWrappedText(
        measure,
        content.name,
        stubInnerW,
        contentBottom - nameTop,
        4,
        2
      );
      const blockH = fitted.lines.length * fitted.sizeMm * LINE_HEIGHT;
      // 半券の中央に寄せつつ、番号と下端にはかからないようにする
      const yStart = Math.min(
        Math.max(h / 2 - blockH / 2, nameTop),
        Math.max(contentBottom - blockH, nameTop)
      );
      fitted.lines.forEach((line, i) => {
        texts.push({
          text: line,
          xMm: PAD,
          yTopMm: yStart + i * fitted.sizeMm * LINE_HEIGHT,
          sizeMm: fitted.sizeMm,
          weight: "regular",
          color: "ink",
        });
      });
    }
  }

  // ---- 本券(メイン領域) ----
  const mainX0 = stub ? stubW + PAD : PAD;
  const mainX1 = w - PAD;
  const nameTop = PAD + NUMBER_SIZE + 2.5; // 商品名を置ける上限(番号の下)

  // 商品名・値段は同じ最大サイズを基準にし、見た目の大きさを揃える
  // 番号を小さくした分の余白を商品名・値段に回し、視認性を優先する
  const largeTextMax = Math.min(h * 0.2, 10);
  // 商品名がこれを下回ると文字がつぶれて読みにくくなるため、
  // イラストを控えめにしてでも確保したい下限サイズ
  const NAME_LEGIBLE_MIN = 4.5;

  // 指定した textW を前提に、値段・商品名のフィット結果を計算する
  function fitContent(textW: number) {
    let priceTop = contentBottom;
    let priceSize = 0;
    if (content.priceText) {
      priceSize = fitFontSize(measure, content.priceText, textW, largeTextMax, 3);
      priceTop = contentBottom - priceSize;
    }
    const nameBottomLimit = content.priceText ? priceTop - 2 : contentBottom;
    const fittedName = content.name
      ? fitWrappedText(measure, content.name, textW, nameBottomLimit - nameTop, largeTextMax, 3)
      : null;
    return { priceTop, priceSize, nameBottomLimit, fittedName };
  }

  // イラスト領域: 右端に正方形を確保(参考画像と同じく右側・上下中央)。
  // ただし、それによって商品名が NAME_LEGIBLE_MIN を下回るほど小さくなる場合は、
  // イラストを縮めて文字の可読性を優先する
  let illustrationBox: RectMm | null = null;
  let textW = mainX1 - mainX0;
  let fit = fitContent(textW);
  if (content.illustration.kind !== "none") {
    const maxSide = Math.min((h - PAD * 2) * 0.7, (mainX1 - mainX0) * 0.45, 30);
    const minSide = 14; // これより小さくすると絵として認識しづらいため下限とする
    let side = maxSide;
    let candidateTextW = mainX1 - side - 2 - mainX0;
    let candidateFit = fitContent(candidateTextW);
    while (
      side > minSide &&
      content.name &&
      (candidateFit.fittedName?.sizeMm ?? Infinity) < NAME_LEGIBLE_MIN
    ) {
      side = Math.max(minSide, side - 2);
      candidateTextW = mainX1 - side - 2 - mainX0;
      candidateFit = fitContent(candidateTextW);
    }
    if (side >= 6) {
      illustrationBox = {
        x: mainX1 - side,
        y: PAD + (contentBottom - PAD - side) / 2,
        w: side,
        h: side,
      };
      textW = candidateTextW;
      fit = candidateFit;
    }
  }

  // 番号(左上) - 本券側は、利用可能な幅に収まるよう自動縮小
  texts.push({
    text: content.numberText,
    xMm: mainX0,
    yTopMm: PAD,
    sizeMm: fitFontSize(measure, content.numberText, mainX1 - mainX0 - PAD, NUMBER_SIZE, 1.5),
    weight: "regular",
    color: "ink",
  });

  // 値段(下端に固定)
  if (content.priceText) {
    texts.push({
      text: content.priceText,
      xMm: mainX0,
      yTopMm: fit.priceTop,
      sizeMm: fit.priceSize,
      weight: "bold",
      color: "ink",
    });
  }

  // 商品名(大)。券の縦方向中央に配置しつつ、番号・値段とは重ならないよう���する
  if (content.name && fit.fittedName) {
    const fitted = fit.fittedName;
    const nameBottomLimit = fit.nameBottomLimit;
    const blockH = fitted.lines.length * fitted.sizeMm * LINE_HEIGHT;
    // 券の縦中央に寄せつつ、番号の下・値段の上の範囲からははみ出さない
    const yStart = Math.min(
      Math.max(h / 2 - blockH / 2, nameTop),
      Math.max(nameBottomLimit - blockH, nameTop)
    );
    fitted.lines.forEach((line, i) => {
      texts.push({
        text: line,
        xMm: mainX0,
        yTopMm: yStart + i * fitted.sizeMm * LINE_HEIGHT,
        sizeMm: fitted.sizeMm,
        weight: "bold",
        color: "ink",
      });
    });
  }

  return {
    widthMm: w,
    heightMm: h,
    texts,
    borderRect,
    borderWidthMm: BORDER_W,
    perforationX,
    perforationY: { from: 1.5, to: h - 1.5 },
    illustrationBox,
  };
}
