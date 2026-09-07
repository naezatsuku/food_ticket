"use client";

import { useState, type Dispatch } from "react";
import { Button, ErrorList, Field, inputClass, NumberInput, Section } from "@/app/components/ui";
import type { Action } from "@/lib/shift/state";
import { formatDateShort, generateSlots, validateSlotGeneration } from "@/lib/shift/slots";
import type { ShiftProject, SlotPreset, TimeSlot } from "@/lib/shift/types";

export function SlotSettingsPanel({
  project,
  dispatch,
  presets,
  onSavePreset,
  onDeletePreset,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
  presets: SlotPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
}) {
  const { slotGeneration, slots } = project;
  const errors = validateSlotGeneration(slotGeneration);
  const preview = errors.length === 0 ? generateSlots(slotGeneration) : [];
  const [presetName, setPresetName] = useState("");

  const existingForDate = slots.filter((s) => s.date === slotGeneration.date).length;
  const dateLabel = slotGeneration.date ? formatDateShort(slotGeneration.date) : "この日";

  const slotsByDate = new Map<string, TimeSlot[]>();
  for (const slot of [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  )) {
    const list = slotsByDate.get(slot.date) ?? [];
    list.push(slot);
    slotsByDate.set(slot.date, list);
  }

  return (
    <div className="space-y-4">
      <Section title="プリセット(枠構成の使い回し)" defaultOpen={presets.length > 0}>
        <p className="text-xs text-slate-400">
          開始・終了時刻、1コマの長さ、休憩時間だけを保存します(対象日は含みません)。
        </p>
        {presets.length === 0 ? (
          <p className="text-xs text-slate-400">
            まだプリセットはありません。下で今の設定を保存すると、次回以降に呼び出せます。
          </p>
        ) : (
          <ul className="space-y-1">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700">
                  {preset.name || "(名称未設定)"}
                  <span className="ml-2 text-xs text-slate-400">
                    {preset.template.start}〜{preset.template.end} / {preset.template.intervalMinutes}分
                  </span>
                </span>
                <div className="flex gap-2">
                  <Button onClick={() => dispatch({ type: "slotGeneration/set", patch: preset.template })}>
                    適用
                  </Button>
                  <Button variant="danger" onClick={() => onDeletePreset(preset.id)}>
                    削除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            className={inputClass}
            placeholder="プリセット名(例: いつもの構成)"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Button
            onClick={() => {
              if (presetName.trim() === "") return;
              onSavePreset(presetName.trim());
              setPresetName("");
            }}
          >
            現在の設定を保存
          </Button>
        </div>
      </Section>

      <Section title="時間枠の一括生成">
        <p className="text-xs text-slate-400">
          対象日を選んで生成すると、その日の枠だけが作られます(置き換わるのはその日の分のみ)。
          日付を変えてもう一度生成すれば、日付を跨いだシフトを作成できます。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="対象日">
            <input
              type="date"
              className={inputClass}
              value={slotGeneration.date}
              onChange={(e) => dispatch({ type: "slotGeneration/set", patch: { date: e.target.value } })}
            />
          </Field>
          <Field label="開始時刻">
            <input
              type="time"
              className={inputClass}
              value={slotGeneration.start}
              onChange={(e) =>
                dispatch({ type: "slotGeneration/set", patch: { start: e.target.value } })
              }
            />
          </Field>
          <Field label="終了時刻">
            <input
              type="time"
              className={inputClass}
              value={slotGeneration.end}
              onChange={(e) =>
                dispatch({ type: "slotGeneration/set", patch: { end: e.target.value } })
              }
            />
          </Field>
          <Field label="1コマの長さ(分)">
            <NumberInput
              value={slotGeneration.intervalMinutes}
              min={1}
              onChange={(n) =>
                dispatch({
                  type: "slotGeneration/set",
                  patch: { intervalMinutes: Math.max(1, Math.trunc(n)) },
                })
              }
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              休憩時間帯(この時間は枠を作りません)
            </span>
            <Button variant="ghost" onClick={() => dispatch({ type: "slotGeneration/addBreak" })}>
              + 追加
            </Button>
          </div>
          {slotGeneration.breaks.length === 0 && (
            <p className="text-xs text-slate-400">休憩時間はありません。</p>
          )}
          {slotGeneration.breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                className={inputClass}
                value={b.start}
                onChange={(e) =>
                  dispatch({
                    type: "slotGeneration/updateBreak",
                    index: i,
                    patch: { start: e.target.value },
                  })
                }
              />
              <span className="text-xs text-slate-400">〜</span>
              <input
                type="time"
                className={inputClass}
                value={b.end}
                onChange={(e) =>
                  dispatch({
                    type: "slotGeneration/updateBreak",
                    index: i,
                    patch: { end: e.target.value },
                  })
                }
              />
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: "slotGeneration/removeBreak", index: i })}
              >
                削除
              </Button>
            </div>
          ))}
        </div>

        <ErrorList errors={errors} />

        <Button
          variant="primary"
          disabled={errors.length > 0}
          onClick={() => {
            const ok =
              existingForDate === 0 ||
              confirm(
                `${dateLabel}の既存の枠(${existingForDate}件)を置き換えて、新たに${preview.length}件の枠を生成します。他の日付の枠には影響しません。個別に設定した必要人数の割り当てはリセットされます。よろしいですか?`
              );
            if (ok) dispatch({ type: "slotGeneration/apply" });
          }}
        >
          {dateLabel}の枠を生成({preview.length}件)
        </Button>
      </Section>

      <Section title={`個別の枠(${slots.length}件・${slotsByDate.size}日)`}>
        {slots.length === 0 ? (
          <p className="text-sm text-slate-400">
            まだ枠がありません。上で一括生成するか、下のボタンで追加してください。
          </p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {Array.from(slotsByDate.entries()).map(([date, dateSlots]) => (
              <div key={date}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    {date ? formatDateShort(date) : "(日付未設定)"} — {dateSlots.length}件
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`${date ? formatDateShort(date) : "(日付未設定)"}の枠をすべて削除しますか?`)) {
                        dispatch({ type: "slot/removeByDate", date });
                      }
                    }}
                  >
                    この日をすべて削除
                  </Button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">開始</th>
                      <th className="py-1 pr-2 font-medium">終了</th>
                      <th className="py-1 pr-2 font-medium">必要人数</th>
                      <th className="py-1 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {dateSlots.map((slot) => (
                      <tr key={slot.id} className="border-b border-slate-100">
                        <td className="py-1 pr-2">
                          <input
                            type="time"
                            className={inputClass}
                            value={slot.start}
                            onChange={(e) =>
                              dispatch({
                                type: "slot/update",
                                id: slot.id,
                                patch: { start: e.target.value },
                              })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="time"
                            className={inputClass}
                            value={slot.end}
                            onChange={(e) =>
                              dispatch({
                                type: "slot/update",
                                id: slot.id,
                                patch: { end: e.target.value },
                              })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput
                            value={slot.capacity}
                            min={0}
                            onChange={(n) =>
                              dispatch({
                                type: "slot/update",
                                id: slot.id,
                                patch: { capacity: Math.max(0, Math.trunc(n)) },
                              })
                            }
                          />
                        </td>
                        <td className="py-1 text-right">
                          <Button
                            variant="danger"
                            onClick={() => dispatch({ type: "slot/remove", id: slot.id })}
                          >
                            削除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        <Button onClick={() => dispatch({ type: "slot/add" })}>+ 枠を手動追加</Button>
      </Section>
    </div>
  );
}
