"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { resolveGrid } from "@/lib/geometry";
import { reducer } from "@/lib/state";
import { loadState, saveState } from "@/lib/storage";
import { defaultAppState } from "@/lib/types";
import { DataPanel } from "./DataPanel";
import { PrintPanel } from "./PrintPanel";
import { ProductPanel } from "./ProductPanel";
import { NumberingPanel, SheetSettingsPanel, TicketSettingsPanel } from "./SettingsPanels";
import { SheetPreview } from "./SheetPreview";

export function TicketApp() {
  const [state, dispatch] = useReducer(reducer, undefined, () => defaultAppState());
  const [hydrated, setHydrated] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [range, setRange] = useState({ start: 1, end: 40 });

  // マウント後(クライアントのみ)に保存済み設定を読み込む。
  // サーバー描画時は localStorage が存在しないため、初期状態は必ず defaultAppState() に揃えてハイドレーション不一致を防ぐ。
  useEffect(() => {
    const loaded = loadState();
    if (loaded) dispatch({ type: "state/replace", state: loaded });
    setHydrated(true);
  }, []);

  // 自動保存(読み込み完了前に空状態で上書き保存しないよう hydrated を待つ)
  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  // 券面フォントの読み込み完了後にプレビューを再計測させる
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      document.fonts.load('400 16px "Ticket JP"'),
      document.fonts.load('700 16px "Ticket JP"'),
    ]).then(() => {
      if (!cancelled) setFontTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const product = state.products.find((p) => p.id === state.selectedProductId) ?? null;

  // 商品を切り替えたら番号範囲をその商品の「次の開始番号」に合わせる
  const lastProductRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !product) return;
    const key = `${product.id}:${product.nextNumber}`;
    if (lastProductRef.current === key) return;
    lastProductRef.current = key;
    const grid = resolveGrid(state.ticket, state.sheet);
    const perSheet = Math.max(1, grid.rows * grid.cols);
    setRange({ start: product.nextNumber, end: product.nextNumber + perSheet - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, product?.id, product?.nextNumber]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <header className="mb-5">
        <Link href="/" className="text-xs font-medium text-blue-600 hover:underline">
          ← ツール一覧
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">🎫 食券メーカー</h1>
        <p className="mt-1 text-xs text-slate-500">
          学園祭・イベント用の食券をデザインして、通し番号付きPDFを印刷用に出力できます。
          データはすべてブラウザ内に保存されます。
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左: 設定パネル */}
        <div className="w-full space-y-4 lg:w-105 lg:shrink-0">
          <ProductPanel
            products={state.products}
            selectedId={state.selectedProductId}
            dispatch={dispatch}
          />
          <TicketSettingsPanel ticket={state.ticket} dispatch={dispatch} />
          <NumberingPanel numbering={state.numbering} dispatch={dispatch} />
          <SheetSettingsPanel ticket={state.ticket} sheet={state.sheet} dispatch={dispatch} />
          <PrintPanel
            state={state}
            product={product}
            startNumber={range.start}
            endNumber={range.end}
            onChangeRange={(start, end) => setRange({ start, end })}
            dispatch={dispatch}
          />
          <DataPanel state={state} dispatch={dispatch} />
        </div>

        {/* 右: プレビュー */}
        <div className="min-w-0 flex-1">
          <div className="lg:sticky lg:top-6">
            <SheetPreview
              state={state}
              product={product}
              startNumber={range.start}
              endNumber={range.end}
              fontTick={fontTick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
