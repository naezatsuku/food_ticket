"use client";

import { useMemo, useState, type Dispatch } from "react";
import { Button, Section } from "@/app/components/ui";
import { buildScheduleResult, runAssignment } from "@/lib/shift/assign/engine";
import type { Action } from "@/lib/shift/state";
import { formatDateShort } from "@/lib/shift/slots";
import type { ShiftProject } from "@/lib/shift/types";

export function AssignPanel({
  project,
  dispatch,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
}) {
  const [running, setRunning] = useState(false);
  const result = useMemo(() => buildScheduleResult(project, project.assignments), [project]);

  const personById = new Map(project.people.map((p) => [p.id, p]));
  const slotById = new Map(project.slots.map((s) => [s.id, s]));
  const roleById = new Map(project.roles.map((r) => [r.id, r]));

  const readyIssues: string[] = [];
  if (project.slots.length === 0) readyIssues.push("時間枠が設定されていません(「枠設定」タブへ)。");
  if (project.roles.length === 0) readyIssues.push("役割が設定されていません(「役割設定」タブへ)。");
  if (project.people.length === 0) readyIssues.push("メンバーが取り込まれていません(「元データ入力」タブへ)。");

  const lockedCount = project.assignments.filter((a) => a.locked).length;
  const hasExistingAssignments = project.assignments.length > 0;

  function handleRun() {
    setRunning(true);
    try {
      const next = runAssignment(project);
      dispatch({ type: "assignments/replace", assignments: next.assignments });
    } finally {
      setRunning(false);
    }
  }

  const maxFairness = Math.max(1, ...result.fairness.map((f) => f.assignedCount));

  return (
    <div className="space-y-4">
      <Section title="自動割当">
        {readyIssues.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-500">
            {readyIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">
            希望時間帯・役割の必要人数をもとに、できるだけ均等かつ希望に沿うよう自動でシフトを割り当てます。
            {hasExistingAssignments && lockedCount > 0 && (
              <> ロック済みの割当({lockedCount}件)は動かさず、残りだけ再計算します。</>
            )}
          </p>
        )}
        <Button variant="primary" disabled={readyIssues.length > 0 || running} onClick={handleRun}>
          {hasExistingAssignments ? "再計算する" : "自動生成を実行"}
        </Button>
      </Section>

      {hasExistingAssignments && (
        <>
          <Section title={`未割当のメンバー(${result.unassignedPeople.length}人)`} defaultOpen={result.unassignedPeople.length > 0}>
            {result.unassignedPeople.length === 0 ? (
              <p className="text-sm text-emerald-600">全員がどこかに割り当てられています。</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {result.unassignedPeople.map((u) => (
                  <li key={u.personId} className="text-slate-600">
                    <span className="font-medium">{personById.get(u.personId)?.name ?? u.personId}</span>
                    <span className="text-xs text-slate-400"> — {u.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={`人員が不足している枠(${result.understaffedSlots.length}件)`}
            defaultOpen={result.understaffedSlots.length > 0}
          >
            {result.understaffedSlots.length === 0 ? (
              <p className="text-sm text-emerald-600">すべての枠で最低人数を満たしています。</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {result.understaffedSlots.map((u, i) => {
                  const slot = slotById.get(u.slotId);
                  const role = roleById.get(u.roleId);
                  const slotLabel = slot
                    ? `${formatDateShort(slot.date)} ${slot.start}〜${slot.end}`
                    : u.slotId;
                  return (
                    <li key={i} className="text-red-600">
                      {slotLabel} ・ {role?.name ?? u.roleId}:
                      あと{u.shortage}人不足
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="割当コマ数の分布(均等性の確認)" defaultOpen={false}>
            {result.fairness.length === 0 ? (
              <p className="text-sm text-slate-400">メンバーがいません。</p>
            ) : (
              <div className="space-y-1">
                {result.fairness.map((f) => {
                  const name = personById.get(f.personId)?.name ?? f.personId;
                  return (
                    <div
                      key={f.personId}
                      className="flex items-center gap-2 text-xs"
                      title={`${name}: ${f.assignedCount}コマ`}
                    >
                      <span className="w-24 shrink-0 truncate text-slate-600">{name}</span>
                      <div className="h-3 flex-1 rounded bg-slate-100">
                        <div
                          className="h-3 rounded bg-blue-400"
                          style={{ width: `${(f.assignedCount / maxFairness) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-slate-500">{f.assignedCount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
