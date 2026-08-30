"use client";

import { useEffect, useReducer, useState, type Dispatch } from "react";
import { Button } from "@/app/components/ui";
import { appReducer, defaultAppState, type AppAction } from "@/lib/shift/appState";
import type { Action } from "@/lib/shift/state";
import { LocalStorageAdapter } from "@/lib/shift/storage";
import type { ShiftProject } from "@/lib/shift/types";
import { AssignPanel } from "./AssignPanel";
import { ComingSoonPanel } from "./ComingSoonPanel";
import { ImportPanel } from "./ImportPanel";
import { ProjectListView } from "./ProjectListView";
import { ProjectPanel } from "./ProjectPanel";
import { RoleSettingsPanel } from "./RoleSettingsPanel";
import { SlotSettingsPanel } from "./SlotSettingsPanel";
import { IMPLEMENTED_STEP_COUNT, STEP_LABELS, StepIndicator } from "./StepIndicator";

const storage = new LocalStorageAdapter();

export function ShiftApp() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => defaultAppState());
  const [hydrated, setHydrated] = useState(false);

  // マウント後(クライアントのみ)に保存済みプロジェクト一覧を読み込む。
  // サーバー描画時は localStorage が存在しないため、初期状態は必ず defaultAppState() に揃えてハイドレーション不一致を防ぐ。
  useEffect(() => {
    let cancelled = false;
    storage.load().then((file) => {
      if (cancelled) return;
      dispatch({ type: "projects/replaceAll", file });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 自動保存(読み込み完了前に空状態で上書き保存しないよう hydrated を待つ)
  useEffect(() => {
    if (hydrated) storage.save(state);
  }, [state, hydrated]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        読み込み中...
      </div>
    );
  }

  const project = state.projects.find((p) => p.id === state.activeProjectId) ?? null;

  if (!project) {
    return <ProjectListView projects={state.projects} dispatch={dispatch} />;
  }

  // key={project.id} により、別プロジェクトを開いたときに ProjectWizard を丸ごと再マウントして
  // ステップ位置などのローカル状態をリセットする(useEffect で明示的にリセットするより単純で安全)。
  return <ProjectWizard key={project.id} project={project} dispatch={dispatch} />;
}

function ProjectWizard({
  project,
  dispatch,
}: {
  project: ShiftProject;
  dispatch: Dispatch<AppAction>;
}) {
  const [step, setStep] = useState(0);
  const projectDispatch: Dispatch<Action> = (action) => dispatch({ type: "project", action });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">📅 シフト作成 — {project.name || "(名称未設定)"}</h1>
        <p className="mt-1 text-xs text-slate-500">
          時間枠と役割の要件を設定し、希望シフトから自動でシフト表を作成します。データはすべてブラウザ内に保存されます。
        </p>
      </header>

      <div className="mb-5">
        <StepIndicator step={step} onSelect={setStep} />
      </div>

      {step === 0 && (
        <ProjectPanel
          project={project}
          dispatch={projectDispatch}
          onBackToList={() => dispatch({ type: "projects/select", id: null })}
        />
      )}
      {step === 1 && <SlotSettingsPanel project={project} dispatch={projectDispatch} />}
      {step === 2 && <RoleSettingsPanel project={project} dispatch={projectDispatch} />}
      {step === 3 && <ImportPanel project={project} dispatch={projectDispatch} />}
      {step === 4 && <AssignPanel project={project} dispatch={projectDispatch} />}
      {step >= IMPLEMENTED_STEP_COUNT && <ComingSoonPanel title={STEP_LABELS[step]} />}

      <nav className="mt-6 flex justify-between">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          ← 戻る
        </Button>
        <Button
          variant="primary"
          disabled={step === STEP_LABELS.length - 1}
          onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))}
        >
          次へ →
        </Button>
      </nav>
    </div>
  );
}
