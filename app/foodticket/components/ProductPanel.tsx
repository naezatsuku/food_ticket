"use client";

import { useState } from "react";
import type { Dispatch } from "react";
import { resizeImageFile } from "@/lib/images";
import type { Action } from "@/lib/state";
import type { Product } from "@/lib/types";
import { Button, Field, inputClass, NumberInput, Section } from "@/app/components/ui";

const FOOD_EMOJIS = [
  "🍛", "🍜", "🍝", "🍚", "🍙", "🍣", "🍤", "🍔", "🍟", "🌭",
  "🍕", "🥪", "🌮", "🥟", "🍢", "🍡", "🍗", "🥩", "🥓", "🍳",
  "🥞", "🧇", "🍞", "🥐", "🥗", "🍧", "🍨", "🍦", "🧁", "🍰",
  "🎂", "🍩", "🍪", "🍫", "🍬", "🍭", "🍎", "🍓", "🍉", "🍌",
  "🥤", "🧋", "☕", "🍵", "🍺", "🍹", "🌽", "🍿",
];

function IllustrationEditor({
  product,
  dispatch,
}: {
  product: Product;
  dispatch: Dispatch<Action>;
}) {
  const [imageError, setImageError] = useState<string | null>(null);
  const kind = product.illustration.kind;

  const setIllustration = (illustration: Product["illustration"]) =>
    dispatch({ type: "product/update", id: product.id, patch: { illustration } });

  return (
    <Field label="イラスト">
      <div className="flex gap-3 mb-2">
        {(
          [
            ["none", "なし"],
            ["emoji", "絵文字"],
            ["image", "画像"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name={`ill-${product.id}`}
              checked={kind === k}
              onChange={() => {
                if (k === "none") setIllustration({ kind: "none" });
                else if (k === "emoji") setIllustration({ kind: "emoji", emoji: "🍛" });
                else setIllustration({ kind: "image", dataUrl: "" });
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {kind === "emoji" && (
        <div className="grid grid-cols-8 gap-1 rounded border border-slate-200 p-2 max-h-40 overflow-y-auto">
          {FOOD_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIllustration({ kind: "emoji", emoji: e })}
              className={`rounded p-1 text-xl leading-none hover:bg-slate-100 ${
                product.illustration.kind === "emoji" && product.illustration.emoji === e
                  ? "bg-blue-100 ring-2 ring-blue-400"
                  : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {kind === "image" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="block w-full text-xs text-slate-500"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImageError(null);
              try {
                const dataUrl = await resizeImageFile(file);
                setIllustration({ kind: "image", dataUrl });
              } catch (err) {
                setImageError(err instanceof Error ? err.message : "画像の読み込みに失敗しました。");
              }
            }}
          />
          {imageError && <p className="text-xs text-red-600">{imageError}</p>}
          {product.illustration.kind === "image" && product.illustration.dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.illustration.dataUrl}
              alt="アップロード画像"
              className="h-16 w-16 rounded border border-slate-200 object-contain"
            />
          )}
        </div>
      )}
    </Field>
  );
}

export function ProductPanel({
  products,
  selectedId,
  dispatch,
}: {
  products: Product[];
  selectedId: string | null;
  dispatch: Dispatch<Action>;
}) {
  const selected = products.find((p) => p.id === selectedId) ?? null;

  return (
    <Section title="商品(券種)">
      {/* 商品リスト */}
      <ul className="space-y-1">
        {products.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer ${
              p.id === selectedId
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
            onClick={() => dispatch({ type: "product/select", id: p.id })}
          >
            <span className="flex-1 truncate text-sm">
              {p.name || <span className="text-slate-400">(名称未設定)</span>}
            </span>
            <span className="text-xs text-slate-400">
              {p.price !== null ? `${p.price.toLocaleString("ja-JP")}円` : "-"}
            </span>
            <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                title="上へ"
                disabled={i === 0}
                className="rounded px-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                onClick={() => dispatch({ type: "product/move", id: p.id, dir: -1 })}
              >
                ↑
              </button>
              <button
                type="button"
                title="下へ"
                disabled={i === products.length - 1}
                className="rounded px-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                onClick={() => dispatch({ type: "product/move", id: p.id, dir: 1 })}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={() => dispatch({ type: "product/add" })}>+ 商品を追加</Button>
        {selected && (
          <>
            <Button onClick={() => dispatch({ type: "product/duplicate", id: selected.id })}>
              複製
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`「${selected.name || "(名称未設定)"}」を削除しますか?`)) {
                  dispatch({ type: "product/remove", id: selected.id });
                }
              }}
            >
              削除
            </Button>
          </>
        )}
      </div>

      {/* 選択中の商品の編集 */}
      {selected && (
        <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
          <Field label="商品名">
            <input
              type="text"
              className={inputClass}
              value={selected.name}
              placeholder="例: カレーライス"
              onChange={(e) =>
                dispatch({
                  type: "product/update",
                  id: selected.id,
                  patch: { name: e.target.value },
                })
              }
            />
          </Field>
          <Field label="値段(円)。空欄で非表示、0で¥0(無料)">
            <input
              type="number"
              className={inputClass}
              min={0}
              value={selected.price ?? ""}
              placeholder="例: 500"
              onChange={(e) => {
                const s = e.target.value;
                const n = Number(s);
                dispatch({
                  type: "product/update",
                  id: selected.id,
                  patch: { price: s === "" || !Number.isFinite(n) ? null : Math.max(0, Math.trunc(n)) },
                });
              }}
            />
          </Field>
          <IllustrationEditor product={selected} dispatch={dispatch} />
          <Field label="次の開始番号(この商品の連番の続き)">
            <NumberInput
              value={selected.nextNumber}
              min={1}
              onChange={(n) =>
                dispatch({
                  type: "product/update",
                  id: selected.id,
                  patch: { nextNumber: Math.max(1, Math.trunc(n)) },
                })
              }
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
