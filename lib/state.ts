import type {
  AppState,
  LogEntry,
  NumberingSettings,
  Product,
  SheetSettings,
  TicketSettings,
} from "./types";
import { createProduct } from "./types";

export type Action =
  | { type: "product/add" }
  | { type: "product/update"; id: string; patch: Partial<Product> }
  | { type: "product/duplicate"; id: string }
  | { type: "product/remove"; id: string }
  | { type: "product/move"; id: string; dir: -1 | 1 }
  | { type: "product/select"; id: string }
  | { type: "ticket/set"; patch: Partial<TicketSettings> }
  | { type: "numbering/set"; patch: Partial<NumberingSettings> }
  | { type: "sheet/set"; patch: Partial<SheetSettings> }
  | { type: "log/add"; entry: LogEntry }
  | { type: "log/clear" }
  | { type: "state/replace"; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "product/add": {
      const p = createProduct({ name: "新しい商品" });
      return { ...state, products: [...state.products, p], selectedProductId: p.id };
    }
    case "product/update":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p
        ),
      };
    case "product/duplicate": {
      const src = state.products.find((p) => p.id === action.id);
      if (!src) return state;
      const copy: Product = { ...src, id: crypto.randomUUID(), name: src.name + "(コピー)" };
      const idx = state.products.indexOf(src);
      const products = [...state.products];
      products.splice(idx + 1, 0, copy);
      return { ...state, products, selectedProductId: copy.id };
    }
    case "product/remove": {
      const products = state.products.filter((p) => p.id !== action.id);
      const selectedProductId =
        state.selectedProductId === action.id
          ? (products[0]?.id ?? null)
          : state.selectedProductId;
      return { ...state, products, selectedProductId };
    }
    case "product/move": {
      const idx = state.products.findIndex((p) => p.id === action.id);
      const to = idx + action.dir;
      if (idx < 0 || to < 0 || to >= state.products.length) return state;
      const products = [...state.products];
      [products[idx], products[to]] = [products[to], products[idx]];
      return { ...state, products };
    }
    case "product/select":
      return { ...state, selectedProductId: action.id };
    case "ticket/set":
      return { ...state, ticket: { ...state.ticket, ...action.patch } };
    case "numbering/set":
      return { ...state, numbering: { ...state.numbering, ...action.patch } };
    case "sheet/set":
      return { ...state, sheet: { ...state.sheet, ...action.patch } };
    case "log/add":
      return { ...state, logs: [action.entry, ...state.logs] };
    case "log/clear":
      return { ...state, logs: [] };
    case "state/replace":
      return action.state;
  }
}
