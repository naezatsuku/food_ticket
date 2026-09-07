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
  /**
   * true なら時計回りに90度回転して描画する(通し番号を短辺に平行にする設定用)。
   * (xMm, yTopMm) を左上として、横方向にフォントサイズ分、縦方向に文字列の長さ分の
   * 領域を占める(回転後の見た目の外接矩形がこの領域になる)。
   */
  rotated?: boolean;
}

export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 券1枚のレイアウト計算結果(mm 座標、券の左上原点)。プレビューと PDF が共有する */
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
  /** 通し番号の向き。省略時は "horizontal"(長辺に平行、従来どおり) */
  numberOrientation?: "horizontal" | "vertical";
}

const PAD = 3; // 券内の基本パディング(mm)
const NUMBER_SIZE = 2.2; // 番号のフォントサイズ(mm。商品名・値段より控えめに)
const PRICE_MAX_SIZE = 2.2; // 値段の最大フォントサイズ(mm。番号と同じサイズに)
const MIN_SPACING = 1; // 番号・商品名・値段の間の最小スペース(mm)

interface NumberPlacement {
  text: TextElement;
  /** 番号がその場で消費する横幅(mm)。縦書き時のみ非ゼロで、後続のテキストはこの分右にずらす */
  widthUsed: number;
  /** 番号がその場で消費する高さ(mm)。横書き時のみ非ゼロで、後続のテキストはこの分下にずらす */
  heightUsed: number;
}

/**
 * 通し番号のテキスト要素を組み立てる。
 * - 横書き(従来): (x, y) を左上に、利用可能な幅に収まるフォントサイズで描く。
 *   高さ方向に NUMBER_SIZE 分のスペースを消費したとみなす(実際のフィット結果に関わらず一定)。
 * - 縦書き(短辺に平行): 90度回転して描く。利用可能な高さに収まるフォントサイズを選び、
 *   横方向にそのフォントサイズ分のスペースを消費する。
 */
function layoutNumber(
  measure: MeasureFn,
  numberText: string,
  xMm: number,
  yMm: number,
  availableWidthMm: number,
  availableHeightMm: number,
  orientation: "horizontal" | "vertical"
): NumberPlacement {
  if (orientation === "vertical") {
    const sizeMm = fitFontSize(measure, numberText, availableHeightMm, NUMBER_SIZE, 1.2);
    return {
      text: { text: numberText, xMm, yTopMm: yMm, sizeMm, weight: "regular", color: "ink", rotated: true },
      widthUsed: sizeMm,
      heightUsed: 0,
    };
  }
  const sizeMm = fitFontSize(measure, numberText, availableWidthMm, NUMBER_SIZE, 1.5);
  return {
    text: { text: numberText, xMm, yTopMm: yMm, sizeMm, weight: "regular", color: "ink" },
    widthUsed: 0,
    heightUsed: NUMBER_SIZE,
  };
}

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
  const numberOrientation = content.numberOrientation ?? "horizontal";

  // ---- 半券(左側) ----
  if (stub) {
    const stubInnerW = stubW - PAD * 2;
    const stubPlacement = layoutNumber(
      measure,
      content.numberText,
      PAD,
      PAD,
      stubInnerW,
      contentBottom - PAD,
      numberOrientation
    );
    texts.push(stubPlacement.text);
    if (content.name) {
      const nameLeft = PAD + stubPlacement.widthUsed + (stubPlacement.widthUsed > 0 ? MIN_SPACING : 0);
      const nameTop = PAD + stubPlacement.heightUsed + (stubPlacement.heightUsed > 0 ? 2 : 0);
      const fitted = fitWrappedText(
        measure,
        content.name,
        stubInnerW - stubPlacement.widthUsed - (stubPlacement.widthUsed > 0 ? MIN_SPACING : 0),
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
          xMm: nameLeft,
          yTopMm: yStart + i * fitted.sizeMm * LINE_HEIGHT,
          sizeMm: fitted.sizeMm,
          weight: "regular",
          color: "ink",
        });
      });
    }
  }

  // ---- 本券(メイン領域) ----
  const mainX0Base = stub ? stubW + PAD : PAD;
  const mainX1 = w - PAD;
  const mainPlacement = layoutNumber(
    measure,
    content.numberText,
    mainX0Base,
    PAD,
    mainX1 - mainX0Base - PAD,
    contentBottom - PAD,
    numberOrientation
  );
  // 番号が縦書きなら横方向に、横書きなら縦方向にスペースを消費する
  const mainX0 = mainX0Base + mainPlacement.widthUsed + (mainPlacement.widthUsed > 0 ? MIN_SPACING : 0);
  const nameTop = PAD + mainPlacement.heightUsed + (mainPlacement.heightUsed > 0 ? MIN_SPACING : 0); // 商品名を置ける上限

  // 商品名がこれを下回ると文字がつぶれて読みにくくなるため、
  // イラストを控えめにしてでも確保したい下限サイズ
  const NAME_LEGIBLE_MIN = 4.5;

  // 指定した textW を前提に、値段・商品名のフィット結果を計算する
  // ナンバー、商品名、値段が重ならないようスペース計算
  function fitContent(textW: number) {
    let priceTop = contentBottom;
    let priceSize = 0;
    
    // 値段: 最大サイズを PRICE_MAX_SIZE に制限
    if (content.priceText) {
      priceSize = fitFontSize(measure, content.priceText, textW, PRICE_MAX_SIZE, 2);
      priceTop = contentBottom - priceSize;
    }
    
    // 商品名の利用可能エリア
    // nameTop（番号の下端） から priceTop（値段の上端）までの間に商品名を配置
    const nameMaxHeight = priceTop - nameTop - MIN_SPACING;
    
    const fittedName = content.name
      ? fitWrappedText(measure, content.name, textW, nameMaxHeight, 8, 2.5)
      : null;
    
    return { priceTop, priceSize, fittedName };
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

  // 番号(左上、または縦書き時は左側の縦帯)
  texts.push(mainPlacement.text);

  // 値段(下端に固定) - 重なり防止のため priceTop を再計算
  if (content.priceText) {
    // 商品名があれば、商品名と値段の間に最小スペースを確保
    let finalPriceTop = fit.priceTop;
    if (content.name && fit.fittedName) {
      const nameBottomY = nameTop + fit.fittedName.lines.length * fit.fittedName.sizeMm * LINE_HEIGHT;
      const minRequiredTop = nameBottomY + MIN_SPACING;
      finalPriceTop = Math.max(finalPriceTop, minRequiredTop);
    }
    
    texts.push({
      text: content.priceText,
      xMm: mainX0,
      yTopMm: finalPriceTop,
      sizeMm: fit.priceSize,
      weight: "bold",
      color: "ink",
    });
  }

  // 商品名(大)。番号・値段とは絶対に重ならないようにする
  if (content.name && fit.fittedName) {
    const fitted = fit.fittedName;
    const blockH = fitted.lines.length * fitted.sizeMm * LINE_HEIGHT;
    
    // 商品名の配置: nameTop から始まり、値段の上 MIN_SPACING mm 上までの空間に収める
    let priceTopForName = fit.priceTop;
    if (content.priceText) {
      priceTopForName = fit.priceTop - MIN_SPACING;
    }
    
    const maxNameHeight = priceTopForName - nameTop;
    
    // 配置済みの商品名サイズが収まらない場合、再計算して縮小
    if (blockH > maxNameHeight && maxNameHeight > 0) {
      const refittedName = fitWrappedText(
        measure,
        content.name,
        textW,
        maxNameHeight,
        fitted.sizeMm,
        2
      );
      fitted.sizeMm = refittedName.sizeMm;
      fitted.lines = refittedName.lines;
    }
    
    // 券の縦中央に寄せつつ、番号の下・値段の上の範囲からははみ出さない
    const finalBlockH = fitted.lines.length * fitted.sizeMm * LINE_HEIGHT;
    const availableHeight = priceTopForName - nameTop;
    const yStart = Math.max(
      nameTop,
      Math.min(
        availableHeight / 2 + nameTop - finalBlockH / 2,
        priceTopForName - finalBlockH
      )
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
    borderWidthMm: ticket.borderWidthMm,
    perforationX,
    perforationY: { from: 1.5, to: h - 1.5 },
    illustrationBox,
  };
}
