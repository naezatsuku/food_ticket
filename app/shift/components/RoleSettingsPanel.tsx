"use client";

import { Fragment, useState, type Dispatch } from "react";
import { Button, ErrorList, Field, inputClass, NumberInput, Section } from "@/app/components/ui";
import type { Action } from "@/lib/shift/state";
import { checkSlotOverCapacity, requirementFor } from "@/lib/shift/roles";
import { formatDateShort } from "@/lib/shift/slots";
import type { Role, ShiftProject, TimeSlot } from "@/lib/shift/types";

export function RoleSettingsPanel({
  project,
  dispatch,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
}) {
  const { roles, slots } = project;
  const warnings = checkSlotOverCapacity(slots, roles);
  const warningMessages = warnings.map((w) => {
    const slot = slots.find((s) => s.id === w.slotId);
    const label = slot ? `${formatDateShort(slot.date)} ${slot.start}〜${slot.end}` : w.slotId;
    return `枠 ${label}: 役割の最低人数の合計(${w.totalMin}人)が枠の定員(${w.capacity}人)を超えています。`;
  });

  return (
    <div className="space-y-4">
      <Section title="役割">
        <div className="space-y-2">
          {roles.length === 0 && <p className="text-sm text-slate-400">まだ役割がありません。</p>}
          {roles.map((role) => (
            <div key={role.id} className="flex items-center gap-2">
              <input
                type="color"
                className="h-8 w-8 rounded border border-slate-300"
                value={role.colorHex}
                onChange={(e) =>
                  dispatch({ type: "role/update", id: role.id, patch: { colorHex: e.target.value } })
                }
              />
              <input
                type="text"
                className={inputClass}
                value={role.name}
                placeholder="役割名(例: レジ)"
                onChange={(e) =>
                  dispatch({ type: "role/update", id: role.id, patch: { name: e.target.value } })
                }
              />
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(`役割「${role.name || "無題"}」を削除しますか?`)) {
                    dispatch({ type: "role/remove", id: role.id });
                  }
                }}
              >
                削除
              </Button>
            </div>
          ))}
        </div>
        <Button onClick={() => dispatch({ type: "role/add" })}>+ 役割を追加</Button>
      </Section>

      <ErrorList errors={warningMessages} />

      {slots.length === 0 ? (
        <Section title="枠ごとの必要人数">
          <p className="text-sm text-slate-400">先に「枠設定」で時間枠を作成してください。</p>
        </Section>
      ) : (
        roles.map((role) => (
          <RoleRequirementSection key={role.id} role={role} slots={slots} dispatch={dispatch} />
        ))
      )}
    </div>
  );
}

function RoleRequirementSection({
  role,
  slots,
  dispatch,
}: {
  role: Role;
  slots: TimeSlot[];
  dispatch: Dispatch<Action>;
}) {
  const [bulkMin, setBulkMin] = useState(0);
  const [bulkMax, setBulkMax] = useState(1);
  const dates = Array.from(new Set(slots.map((s) => s.date))).sort();
  const [bulkDate, setBulkDate] = useState(""); // "" = すべての日付

  const sortedSlots = [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  );

  return (
    <Section title={`枠ごとの必要人数 — ${role.name || "無題の役割"}`} defaultOpen={false}>
      <div className="flex flex-wrap items-end gap-2 rounded bg-slate-50 p-2">
        <Field label="一括設定: 最低人数">
          <NumberInput value={bulkMin} min={0} onChange={(n) => setBulkMin(Math.max(0, Math.trunc(n)))} />
        </Field>
        <Field label="一括設定: 上限人数">
          <NumberInput value={bulkMax} min={0} onChange={(n) => setBulkMax(Math.max(0, Math.trunc(n)))} />
        </Field>
        {dates.length > 1 && (
          <Field label="対象日">
            <select className={inputClass} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}>
              <option value="">すべての日付</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDateShort(d)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Button
          onClick={() =>
            dispatch({
              type: "requirement/bulkApply",
              roleId: role.id,
              min: bulkMin,
              max: bulkMax,
              dateFilter: bulkDate || undefined,
            })
          }
        >
          {bulkDate ? `${formatDateShort(bulkDate)}に適用` : "全枠に適用"}
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-1 pr-2 font-medium">枠</th>
              <th className="py-1 pr-2 font-medium">最低人数</th>
              <th className="py-1 font-medium">上限人数</th>
            </tr>
          </thead>
          <tbody>
            {sortedSlots.map((slot, i) => {
              const req = requirementFor(role, slot.id);
              const isNewDate = i === 0 || sortedSlots[i - 1].date !== slot.date;
              return (
                <Fragment key={slot.id}>
                  {isNewDate && (
                    <tr key={`date-${slot.date}`}>
                      <td colSpan={3} className="bg-slate-50 py-1 pr-2 text-[11px] font-semibold text-slate-500">
                        {slot.date ? formatDateShort(slot.date) : "(日付未設定)"}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {slot.start}〜{slot.end}
                    </td>
                    <td className="py-1 pr-2">
                      <NumberInput
                        value={req.min}
                        min={0}
                        onChange={(n) =>
                          dispatch({
                            type: "requirement/set",
                            roleId: role.id,
                            slotId: slot.id,
                            patch: { min: Math.max(0, Math.trunc(n)) },
                          })
                        }
                      />
                    </td>
                    <td className="py-1">
                      <NumberInput
                        value={req.max}
                        min={0}
                        onChange={(n) =>
                          dispatch({
                            type: "requirement/set",
                            roleId: role.id,
                            slotId: slot.id,
                            patch: { max: Math.max(0, Math.trunc(n)) },
                          })
                        }
                      />
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
