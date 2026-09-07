"use client";

import { useState, type Dispatch } from "react";
import { resolveGrid, sheetsNeeded, validateLayout } from "@/lib/geometry";
import { countInRange, formatTicketNumber, validateRange } from "@/lib/numbering";
import { downloadPdf, generateTicketsPdf } from "@/lib/pdf";
import type { Action } from "@/lib/state";
import type { AppState, Product } from "@/lib/types";
import { Button, ErrorList, Field, Modal, NumberInput, Section } from "@/app/components/ui";

const PAPER_LABEL = { A4: "A4", B5: "B5", A3: "A3" } as const;

export function PrintPanel({
  state,
  product,
  startNumber,
  endNumber,
  onChangeRange,
  dispatch,
}: {
  state: AppState;
  product: Product | null;
  startNumber: number;
  endNumber: number;
  onChangeRange: (start: number, end: number) => void;
  dispatch: Dispatch<Action>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const { ticket, sheet, numbering } = state;
  const grid = resolveGrid(ticket, sheet);
  const perSheet = grid.rows * grid.cols;
  const count = countInRange(startNumber, endNumber);
  const sheets = sheetsNeeded(count, perSheet);

  const errors: string[] = [];
  if (!product) errors.push("出力する商品を選択してください。");
  const rangeError = validateRange(startNumber, endNumber, numbering.digits);
  if (rangeError) errors.push(rangeError);
  errors.push(...validateLayout(ticket, sheet));

  const paperLabel = `${PAPER_LABEL[sheet.paper]}${sheet.orientation === "portrait" ? "縦" : "横"}`;

  async function handleGenerate() {
    if (!product) return;
    setBusy(true);
    setGenError(null);
    try {
      const result = await generateTicketsPdf({
        product,
        ticket,
        numbering,
        sheet,
        startNumber,
        endNumber,
      });
      downloadPdf(
        result.bytes,
        `食券_${product.name || "無題"}_${formatTicketNumber(numbering, startNumber)}-${formatTicketNumber(numbering, endNumber)}.pdf`
      );
      dispatch({
        type: "log/add",
        entry: {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          productName: product.name || "(名称未設定)",
          rangeStart: startNumber,
          rangeEnd: endNumber,
          count: result.count,
          sheets: result.sheets,
        },
      });
      // 次回の追加印刷は続きの番号から
      dispatch({
        type: "product/update",
        id: product.id,
        patch: { nextNumber: endNumber + 1 },
      });
      setConfirmOpen(false);
      onChangeRange(endNumber + 1, endNumber + count);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "PDFの生成に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="PDF出力">
      <div className="grid grid-cols-2 gap-3">
        <Field label="開始番号">
          <NumberInput
            value={startNumber}
            min={1}
            onChange={(n) => onChangeRange(Math.trunc(n), endNumber)}
          />
        </Field>
        <Field label="終了番号">
          <NumberInput
            value={endNumber}
            min={1}
            onChange={(n) => onChangeRange(startNumber, Math.trunc(n))}
          />
        </Field>
      </div>

      {product && rangeError === null && (
        <p className="text-xs text-slate-500">
          {formatTicketNumber(numbering, startNumber)} 〜{" "}
          {formatTicketNumber(numbering, endNumber)} / <b>{count}枚</b> →{" "}
          <b>{sheets}シート</b>({paperLabel}、{perSheet}枚/シート)
        </p>
      )}

      <ErrorList errors={errors} />
      {genError && <ErrorList errors={[genError]} />}

      <Button
        variant="primary"
        disabled={errors.length > 0 || busy}
        onClick={() => setConfirmOpen(true)}
      >
        PDFを生成してダウンロード
      </Button>

      <Modal open={confirmOpen} title="出力内容の確認" onClose={() => !busy && setConfirmOpen(false)}>
        {product && (
          <table className="mb-4 w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 pr-3 text-slate-500">商品名</td>
                <td className="font-medium">{product.name || "(名称未設定)"}</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-slate-500">番号範囲</td>
                <td>
                  {formatTicketNumber(numbering, startNumber)} 〜{" "}
                  {formatTicketNumber(numbering, endNumber)}
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-slate-500">枚数</td>
                <td>{count}枚</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-slate-500">シート数</td>
                <td>{sheets}シート</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 text-slate-500">用紙</td>
                <td>{paperLabel}(余白 {sheet.marginMm}mm)</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="mb-4 text-xs text-slate-400">
          印刷時は「実際のサイズ」(倍率100%)を選ぶと券が指定寸法どおりになります。
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmOpen(false)} disabled={busy}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleGenerate} disabled={busy}>
            {busy ? "生成中..." : "出力する"}
          </Button>
        </div>
      </Modal>
    </Section>
  );
}
