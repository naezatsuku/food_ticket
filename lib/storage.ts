import type { AppState, NumberingSettings } from "./types";
import { defaultAppState } from "./types";

const STORAGE_KEY = "food-ticket-app-v1";

/**
 * 通し番号の設定を正規化する。旧バージョンでは向きが半券・本券で共通の
 * 単一フィールド(orientation)だったため、そちらしか無いデータは
 * 両方の新フィールド(stubOrientation / mainOrientation)へ引き継ぐ。
 */
function normalizeNumbering(
  defaults: NumberingSettings,
  raw: Partial<NumberingSettings> | undefined
): NumberingSettings {
  const r = (raw ?? {}) as Partial<NumberingSettings> & { orientation?: NumberingSettings["stubOrientation"] };
  const legacyOrientation = r.orientation;
  return {
    ...defaults,
    ...r,
    stubOrientation: r.stubOrientation ?? legacyOrientation ?? defaults.stubOrientation,
    mainOrientation: r.mainOrientation ?? legacyOrientation ?? defaults.mainOrientation,
  };
}

/** 不明な形の入力をデフォルト状態にマージして AppState に正規化する */
function normalize(raw: unknown): AppState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("設定データの形式が不正です(オブジェクトではありません)。");
  }
  const d = defaultAppState();
  const r = raw as Partial<AppState>;
  if (!Array.isArray(r.products)) {
    throw new Error("設定データに商品リスト(products)が見つかりません。");
  }
  const state: AppState = {
    products: r.products.map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      name: typeof p.name === "string" ? p.name : "",
      price: typeof p.price === "number" ? p.price : null,
      illustration:
        p.illustration && typeof p.illustration === "object"
          ? p.illustration
          : { kind: "none" },
      nextNumber:
        typeof p.nextNumber === "number" && p.nextNumber >= 1 ? Math.trunc(p.nextNumber) : 1,
    })),
    ticket: { ...d.ticket, ...(r.ticket ?? {}) },
    numbering: normalizeNumbering(d.numbering, r.numbering),
    sheet: { ...d.sheet, ...(r.sheet ?? {}) },
    logs: Array.isArray(r.logs) ? r.logs : [],
    selectedProductId: null,
  };
  state.selectedProductId =
    typeof r.selectedProductId === "string" &&
    state.products.some((p) => p.id === r.selectedProductId)
      ? r.selectedProductId
      : (state.products[0]?.id ?? null);
  return state;
}

export function loadState(): AppState | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return normalize(JSON.parse(json));
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 容量超過(画像が大きい場合など)は自動保存をあきらめる。
    // エクスポート/インポートは引き続き使える。
  }
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify({ app: "food-ticket", version: 1, ...state }, null, 2);
}

/** JSON文字列を検証して AppState を返す。不正な場合は日本語メッセージで throw */
export function parseImportedState(json: string): AppState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("JSONとして読み込めませんでした。エクスポートしたファイルを指定してください。");
  }
  return normalize(raw);
}
