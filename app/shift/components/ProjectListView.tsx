"use client";

import { useRef, useState, type Dispatch } from "react";
import Link from "next/link";
import { Button, Section } from "@/app/components/ui";
import type { AppAction } from "@/lib/shift/appState";
import { parseImportedProject } from "@/lib/shift/storage";
import type { ShiftProject } from "@/lib/shift/types";

export function ProjectListView({
  projects,
  dispatch,
}: {
  projects: ShiftProject[];
  dispatch: Dispatch<AppAction>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportAsNew(file: File) {
    setImportError(null);
    try {
      const imported = parseImportedProject(await file.text());
      dispatch({ type: "projects/import", project: imported });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "読み込みに失敗しました。");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <header className="mb-5">
        <Link href="/" className="text-xs font-medium text-blue-600 hover:underline">
          ← ツール一覧
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">📅 シフト作成</h1>
        <p className="mt-1 text-xs text-slate-500">
          プロジェクトを選んで編集を始めるか、新しいプロジェクトを作成してください。データはすべてブラウザ内に保存されます。
        </p>
      </header>

      <Section title={`プロジェクト一覧(${projects.length}件)`}>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">まだプロジェクトがありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "projects/select", id: p.id })}
                  className="text-left"
                >
                  <p className="font-medium text-slate-800">{p.name || "(名称未設定)"}</p>
                  <p className="text-xs text-slate-400">
                    枠 {p.slots.length}件・役割 {p.roles.length}件・メンバー {p.people.length}人
                  </p>
                </button>
                <div className="flex gap-2">
                  <Button onClick={() => dispatch({ type: "projects/select", id: p.id })}>開く</Button>
                  <Button onClick={() => dispatch({ type: "projects/duplicate", id: p.id })}>複製</Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm(`プロジェクト「${p.name || "(名称未設定)"}」を削除しますか?`)) {
                        dispatch({ type: "projects/delete", id: p.id });
                      }
                    }}
                  >
                    削除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button variant="primary" onClick={() => dispatch({ type: "projects/create" })}>
            + 新規プロジェクト
          </Button>
          <Button onClick={() => fileRef.current?.click()}>JSONから読み込む</Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportAsNew(f);
            e.target.value = "";
          }}
        />
        {importError && <p className="text-xs text-red-600">{importError}</p>}
      </Section>
    </div>
  );
}
