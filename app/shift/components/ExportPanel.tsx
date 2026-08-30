"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, inputClass, Section } from "@/app/components/ui";
import { canvasToBlob, renderScheduleToCanvas } from "@/lib/shift/render/canvas";
import { buildLongFormatCsv, buildPersonCsv, buildWideFormatCsv, type WideAxis } from "@/lib/shift/render/csv";
import { csvToBlob, type CsvEncoding } from "@/lib/shift/render/encoding";
import type { ShiftProject } from "@/lib/shift/types";

type CsvFormat = "long" | "wide-role" | "wide-person";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportPanel({ project }: { project: ShiftProject }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(project.name || "シフト表");
  const [subtitle, setSubtitle] = useState("");
  const [background, setBackground] = useState<"white" | "transparent">("white");
  const [scale, setScale] = useState(2);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const [csvFormat, setCsvFormat] = useState<CsvFormat>("long");
  const [csvEncoding, setCsvEncoding] = useState<CsvEncoding>("utf8-bom");
  const [personId, setPersonId] = useState(project.people[0]?.id ?? "");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderScheduleToCanvas(canvas, project, { title, subtitle, background, scale });
  }, [project, title, subtitle, background, scale]);

  async function handleDownloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    downloadBlob(blob, `${title || "シフト表"}.png`);
  }

  async function handleCopyPng() {
    setCopyMessage(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("no blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyMessage("クリップボードにコピーしました。");
    } catch {
      setCopyMessage("コピーに失敗しました(このブラウザでは対応していない可能性があります)。");
    }
  }

  function currentCsv(): string {
    if (csvFormat === "long") return buildLongFormatCsv(project);
    const axis: WideAxis = csvFormat === "wide-role" ? "role" : "person";
    return buildWideFormatCsv(project, axis);
  }

  function handleDownloadCsv() {
    const blob = csvToBlob(currentCsv(), csvEncoding);
    downloadBlob(blob, `${title || "シフト表"}.csv`);
  }

  function handleDownloadPersonCsv() {
    if (!personId) return;
    const person = project.people.find((p) => p.id === personId);
    const blob = csvToBlob(buildPersonCsv(project, personId), csvEncoding);
    downloadBlob(blob, `${person?.name || "担当"}.csv`);
  }

  const noData = project.slots.length === 0 || project.assignments.length === 0;

  return (
    <div className="space-y-4">
      <Section title="画像出力(PNG)">
        {noData && (
          <p className="text-xs text-amber-600">
            まだ枠や割当がありません。「自動生成」や「編集」で割当を作成すると内容が表示されます。
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="タイトル">
            <input type="text" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="サブタイトル(任意、日付など)">
            <input
              type="text"
              className={inputClass}
              value={subtitle}
              placeholder="例: 2026-08-30"
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </Field>
          <Field label="背景">
            <select
              className={inputClass}
              value={background}
              onChange={(e) => setBackground(e.target.value as "white" | "transparent")}
            >
              <option value="white">白背景</option>
              <option value="transparent">透過</option>
            </select>
          </Field>
          <Field label="解像度">
            <select className={inputClass} value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              <option value={2}>2倍(標準)</option>
              <option value={3}>3倍(高精細)</option>
            </select>
          </Field>
        </div>

        <div className="overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
          <canvas ref={canvasRef} className="max-w-full" style={{ imageRendering: "auto" }} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={handleDownloadPng}>
            PNGをダウンロード
          </Button>
          <Button onClick={handleCopyPng}>クリップボードにコピー</Button>
        </div>
        {copyMessage && <p className="text-xs text-slate-500">{copyMessage}</p>}
      </Section>

      <Section title="CSV出力">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="形式">
            <select className={inputClass} value={csvFormat} onChange={(e) => setCsvFormat(e.target.value as CsvFormat)}>
              <option value="long">ロング形式(1行=1割当)</option>
              <option value="wide-role">ワイド形式(列=役割)</option>
              <option value="wide-person">ワイド形式(列=人)</option>
            </select>
          </Field>
          <Field label="文字コード">
            <select
              className={inputClass}
              value={csvEncoding}
              onChange={(e) => setCsvEncoding(e.target.value as CsvEncoding)}
            >
              <option value="utf8-bom">UTF-8(BOM付き)</option>
              <option value="shift-jis">Shift_JIS</option>
            </select>
          </Field>
        </div>
        <Button variant="primary" onClick={handleDownloadCsv}>
          CSVをダウンロード
        </Button>
      </Section>

      <Section title="個人別に抽出" defaultOpen={false}>
        {project.people.length === 0 ? (
          <p className="text-sm text-slate-400">メンバーがいません。</p>
        ) : (
          <>
            <Field label="対象者">
              <select className={inputClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
                {project.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "(名称未設定)"}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={handleDownloadPersonCsv}>この人のCSVをダウンロード</Button>
          </>
        )}
      </Section>
    </div>
  );
}
