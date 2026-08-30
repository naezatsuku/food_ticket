"use client";

import { useRef, useState, type Dispatch } from "react";
import { Button, Field, inputClass, NumberInput, Section } from "@/app/components/ui";
import type { Action } from "@/lib/shift/state";
import { exportProjectJson, parseImportedProject } from "@/lib/shift/storage";
import type { ShiftProject } from "@/lib/shift/types";
import { defaultShiftProject } from "@/lib/shift/types";

export function ProjectPanel({
  project,
  dispatch,
  onBackToList,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
  onBackToList: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const json = exportProjectJson(project);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `シフト_${project.name || "無題"}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function handleImport(file: File) {
    setImportError(null);
    try {
      const imported = parseImportedProject(await file.text());
      if (
        confirm(
          `シフト設定を読み込みます(枠 ${imported.slots.length} 件・役割 ${imported.roles.length} 件)。現在の内容は上書きされます。よろしいですか?`
        )
      ) {
        dispatch({ type: "state/replace", project: { ...imported, id: project.id } });
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "読み込みに失敗しました。");
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBackToList}>
        ← プロジェクト一覧に戻る
      </Button>

      <Section title="プロジェクト">
        <Field label="シフト表の名前">
          <input
            type="text"
            className={inputClass}
            value={project.name}
            placeholder="例: 文化祭2日目"
            onChange={(e) => dispatch({ type: "project/rename", name: e.target.value })}
          />
        </Field>
        <Field label="1人あたりの既定上限コマ数">
          <NumberInput
            value={project.defaultMaxSlotsPerPerson}
            min={1}
            onChange={(n) =>
              dispatch({ type: "project/setDefaultMaxSlots", value: Math.max(1, Math.trunc(n)) })
            }
          />
        </Field>
        <p className="text-xs text-slate-400">
          次の「枠設定」タブで時間枠を作成し、「役割設定」タブで役割ごとの必要人数を決めます。
        </p>
      </Section>

      <Section title="保存・復元" defaultOpen={false}>
        <p className="text-xs text-slate-400">
          データはブラウザ(localStorage)に自動保存されます。別のPCで使い回すには JSON
          ファイルでエクスポートしてください。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>JSONエクスポート</Button>
          <Button onClick={() => fileRef.current?.click()}>JSONインポート</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("シフトの設定をすべて初期状態に戻します。よろしいですか?")) {
                dispatch({ type: "state/replace", project: { ...defaultShiftProject(), id: project.id } });
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
    </div>
  );
}
