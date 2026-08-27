/** イラスト設定: なし / 絵文字 / アップロード画像 */
export type Illustration =
  | { kind: "none" }
  | { kind: "emoji"; emoji: string }
  | { kind: "image"; dataUrl: string };

/** 商品(券種) */
export interface Product {
  id: string;
  /** 商品名(例: カレーライス) */
  name: string;
  /** 値段(円)。null = 空欄(表示なし)、0 = ¥0 */
  price: number | null;
  illustration: Illustration;
  /** 次に印刷する開始番号(追加印刷で続きから刷るための記憶) */
  nextNumber: number;
}

/** 券1枚のデザイン設定 */
export interface TicketSettings {
  widthMm: number;
  heightMm: number;
  /** 半券(スタブ)モード */
  stubEnabled: boolean;
  /** 半券の幅(mm)。stubEnabled 時のみ有効 */
  stubWidthMm: number;
}

/** 通し番号の設定 */
export interface NumberingSettings {
  /** プレフィックス(デフォルト "No.") */
  prefix: string;
  /** ゼロ埋め桁数 */
  digits: 3 | 4 | 5;
}

export type PaperSize = "A4" | "B5" | "A3";
export type Orientation = "portrait" | "landscape";
export type CutGuideStyle = "dashed" | "crop" | "none";

/** 用紙・シートレイアウト設定 */
export interface SheetSettings {
  paper: PaperSize;
  orientation: Orientation;
  /** 余白(mm) */
  marginMm: number;
  cutGuide: CutGuideStyle;
  /** 手動の行×列指定。null なら自動計算 */
  manualGrid: { rows: number; cols: number } | null;
}

/** 発行ログの1件 */
export interface LogEntry {
  id: string;
  /** ISO 8601 日時 */
  timestamp: string;
  productName: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  sheets: number;
}

/** アプリ全体の状態(localStorage / JSON エクスポート対象) */
export interface AppState {
  products: Product[];
  ticket: TicketSettings;
  numbering: NumberingSettings;
  sheet: SheetSettings;
  logs: LogEntry[];
  selectedProductId: string | null;
}

export function createProduct(partial?: Partial<Product>): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: null,
    illustration: { kind: "none" },
    nextNumber: 1,
    ...partial,
  };
}

export function defaultAppState(): AppState {
  // id を固定し、SSR とクライアントでの初期レンダリングを一致させる
  const sample = createProduct({
    id: "sample-1",
    name: "カレーライス",
    price: 500,
    illustration: { kind: "emoji", emoji: "🍛" },
  });
  return {
    products: [sample],
    ticket: { widthMm: 49, heightMm: 17, stubEnabled: true, stubWidthMm: 13 },
    numbering: { prefix: "No.", digits: 4 },
    sheet: {
      paper: "A3",
      orientation: "portrait",
      marginMm: 0,
      cutGuide: "dashed",
      manualGrid: null,
    },
    logs: [],
    selectedProductId: sample.id,
  };
}
