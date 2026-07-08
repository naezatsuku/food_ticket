"use client";

import { useRef, useState, type Dispatch } from "react";
import { exportStateJson, parseImportedState } from "@/lib/storage";
import type { Action } from "@/lib/state";
import type { AppState } from "@/lib/types";
import { defaultAppState } from "@/lib/types";
import { Button, Section } from "./ui";

/** 設定の保存・復元と発行ログ */
export function DataPanel({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: Dispatch<Action>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const json = exportStateJson(state);
    const sizeMb = new Blob([json]).size / (1024 * 1024);
    if (sizeMb > 3) {
      const ok = confirm(
        `エクスポートファイルが ${sizeMb.toFixed(1)}MB あります(アップロード画像を含むため)。続行しますか?`
      );
      if (!ok) return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `食券設定_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function handleImport(file: File) {
    setImportError(null);
    try {
      const imported = parseImportedState(await file.text());
      if (
        confirm(
          `設定を読み込みます(商品 ${imported.products.length} 件)。現在の設定は上書きされます。よろしいですか?`
        )
      ) {
        dispatch({ type: "state/replace", state: imported });
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "読み込みに失敗しました。");
    }
  }

  return (
    <>
      <Section title="設定の保存・復元" defaultOpen={false}>
        <p className="text-xs text-slate-400">
          設定はブラウザ(localStorage)に自動保存されます。別のPCや来年のイベントで使い回すには
          JSONファイルでエクスポートしてください。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>JSONエクスポート</Button>
          <Button onClick={() => fileRef.current?.click()}>JSONインポート</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("すべての設定を初期状態に戻します。よろしいですか?")) {
                dispatch({ type: "state/replace", state: defaultAppState() });
              }
            }}
          >
            初期化
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        {importError && <p className="text-xs text-red-600">{importError}</p>}
      </Section>

      <Section title={`発行ログ(${state.logs.length}件)`} defaultOpen={false}>
        <p className="text-xs text-slate-400">
          PDFを出力するたびに記録されます。番号の重複印刷を防ぐ確認に使えます。
        </p>
        {state.logs.length === 0 ? (
          <p className="text-sm text-slate-400">まだ出力履歴はありません。</p>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">日時</th>
                  <th className="py-1 pr-2 font-medium">商品</th>
                  <th className="py-1 pr-2 font-medium">番号範囲</th>
                  <th className="py-1 pr-2 font-medium text-right">枚数</th>
                  <th className="py-1 font-medium text-right">シート</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-1 pr-2">{log.productName}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {log.rangeStart}〜{log.rangeEnd}
                    </td>
                    <td className="py-1 pr-2 text-right">{log.count}</td>
                    <td className="py-1 text-right">{log.sheets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.logs.length > 0 && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("発行ログをすべて削除しますか?")) dispatch({ type: "log/clear" });
            }}
          >
            ログをクリア
          </Button>
        )}
      </Section>
    </>
  );
}
