"use client";

import type { Dispatch } from "react";
import { autoGrid, sheetSizeMm } from "@/lib/geometry";
import type { Action } from "@/lib/state";
import type {
  CutGuideStyle,
  NumberingSettings,
  Orientation,
  PaperSize,
  SheetSettings,
  TicketSettings,
} from "@/lib/types";
import { Field, inputClass, NumberInput, Section } from "@/app/components/ui";

export function TicketSettingsPanel({
  ticket,
  dispatch,
}: {
  ticket: TicketSettings;
  dispatch: Dispatch<Action>;
}) {
  return (
    <Section title="券のデザイン">
      <div className="grid grid-cols-2 gap-3">
        <Field label="券の幅(mm)">
          <NumberInput
            value={ticket.widthMm}
            min={20}
            onChange={(n) => dispatch({ type: "ticket/set", patch: { widthMm: n } })}
          />
        </Field>
        <Field label="券の高さ(mm)">
          <NumberInput
            value={ticket.heightMm}
            min={15}
            onChange={(n) => dispatch({ type: "ticket/set", patch: { heightMm: n } })}
          />
        </Field>
        <Field label="枠線の太さ(mm)">
          <NumberInput
            value={ticket.borderWidthMm}
            min={0.1}
            step={0.1}
            onChange={(n) => dispatch({ type: "ticket/set", patch: { borderWidthMm: n } })}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ticket.stubEnabled}
          onChange={(e) =>
            dispatch({ type: "ticket/set", patch: { stubEnabled: e.target.checked } })
          }
        />
        半券(スタブ)を付ける
        <span className="text-xs text-slate-400">— 同じ番号を両側に印字</span>
      </label>
      {ticket.stubEnabled && (
        <Field label="半券の幅(mm)">
          <NumberInput
            value={ticket.stubWidthMm}
            min={10}
            onChange={(n) => dispatch({ type: "ticket/set", patch: { stubWidthMm: n } })}
          />
        </Field>
      )}
    </Section>
  );
}

export function NumberingPanel({
  numbering,
  stubEnabled,
  dispatch,
}: {
  numbering: NumberingSettings;
  stubEnabled: boolean;
  dispatch: Dispatch<Action>;
}) {
  return (
    <Section title="通し番号">
      <div className="grid grid-cols-2 gap-3">
        <Field label="プレフィックス">
          <input
            type="text"
            className={inputClass}
            value={numbering.prefix}
            placeholder="No."
            onChange={(e) =>
              dispatch({ type: "numbering/set", patch: { prefix: e.target.value } })
            }
          />
        </Field>
        <Field label="桁数(ゼロ埋め)">
          <select
            className={inputClass}
            value={numbering.digits}
            onChange={(e) =>
              dispatch({
                type: "numbering/set",
                patch: { digits: Number(e.target.value) as 3 | 4 | 5 },
              })
            }
          >
            <option value={3}>3桁(001)</option>
            <option value={4}>4桁(0001)</option>
            <option value={5}>5桁(00001)</option>
          </select>
        </Field>
      </div>
      {stubEnabled && (
        <Field label="番号の向き(半券側)">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="numbering-stub-orientation"
                checked={numbering.stubOrientation === "horizontal"}
                onChange={() =>
                  dispatch({ type: "numbering/set", patch: { stubOrientation: "horizontal" } })
                }
              />
              長辺に平行(従来どおり)
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="numbering-stub-orientation"
                checked={numbering.stubOrientation === "vertical"}
                onChange={() =>
                  dispatch({ type: "numbering/set", patch: { stubOrientation: "vertical" } })
                }
              />
              短辺に平行(90度回転)
            </label>
          </div>
        </Field>
      )}
      <Field label={stubEnabled ? "番号の向き(本券側)" : "番号の向き"}>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="numbering-main-orientation"
              checked={numbering.mainOrientation === "horizontal"}
              onChange={() =>
                dispatch({ type: "numbering/set", patch: { mainOrientation: "horizontal" } })
              }
            />
            長辺に平行(従来どおり)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="numbering-main-orientation"
              checked={numbering.mainOrientation === "vertical"}
              onChange={() =>
                dispatch({ type: "numbering/set", patch: { mainOrientation: "vertical" } })
              }
            />
            短辺に平行(90度回転)
          </label>
        </div>
      </Field>
      <p className="text-xs text-slate-400">
        連番は商品ごとに独立しています。開始番号は「PDF出力」で指定します。
      </p>
    </Section>
  );
}

export function SheetSettingsPanel({
  ticket,
  sheet,
  dispatch,
}: {
  ticket: TicketSettings;
  sheet: SheetSettings;
  dispatch: Dispatch<Action>;
}) {
  const { w, h } = sheetSizeMm(sheet.paper, sheet.orientation);
  const auto = autoGrid(w, h, sheet.marginMm, ticket.widthMm, ticket.heightMm, sheet.gapMm);

  return (
    <Section title="用紙・シートレイアウト">
      <div className="grid grid-cols-2 gap-3">
        <Field label="用紙サイズ">
          <select
            className={inputClass}
            value={sheet.paper}
            onChange={(e) =>
              dispatch({ type: "sheet/set", patch: { paper: e.target.value as PaperSize } })
            }
          >
            <option value="A4">A4(210×297mm)</option>
            <option value="B5">B5(182×257mm)</option>
            <option value="A3">A3(297×420mm)</option>
          </select>
        </Field>
        <Field label="向き">
          <select
            className={inputClass}
            value={sheet.orientation}
            onChange={(e) =>
              dispatch({
                type: "sheet/set",
                patch: { orientation: e.target.value as Orientation },
              })
            }
          >
            <option value="portrait">縦</option>
            <option value="landscape">横</option>
          </select>
        </Field>
        <Field label="余白(mm)">
          <NumberInput
            value={sheet.marginMm}
            min={0}
            onChange={(n) => dispatch({ type: "sheet/set", patch: { marginMm: n } })}
          />
        </Field>
        <Field label="券の間隔(mm)">
          <NumberInput
            value={sheet.gapMm}
            min={0}
            onChange={(n) => dispatch({ type: "sheet/set", patch: { gapMm: n } })}
          />
        </Field>
        <Field label="切り取りガイド">
          <select
            className={inputClass}
            value={sheet.cutGuide}
            onChange={(e) =>
              dispatch({
                type: "sheet/set",
                patch: { cutGuide: e.target.value as CutGuideStyle },
              })
            }
          >
            <option value="dashed">破線(境界全体)</option>
            <option value="crop">トンボ(交点のみ)</option>
            <option value="none">なし</option>
          </select>
        </Field>
      </div>

      <p className="text-xs text-slate-500">
        自動計算: <b>{auto.rows}行 × {auto.cols}列</b>({auto.rows * auto.cols}枚/シート)
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sheet.manualGrid !== null}
          onChange={(e) =>
            dispatch({
              type: "sheet/set",
              patch: {
                manualGrid: e.target.checked
                  ? { rows: Math.max(1, auto.rows), cols: Math.max(1, auto.cols) }
                  : null,
              },
            })
          }
        />
        行数×列数を手動で指定する
      </label>
      {sheet.manualGrid && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="行数">
            <NumberInput
              value={sheet.manualGrid.rows}
              min={1}
              onChange={(n) =>
                dispatch({
                  type: "sheet/set",
                  patch: { manualGrid: { ...sheet.manualGrid!, rows: Math.max(1, Math.trunc(n)) } },
                })
              }
            />
          </Field>
          <Field label="列数">
            <NumberInput
              value={sheet.manualGrid.cols}
              min={1}
              onChange={(n) =>
                dispatch({
                  type: "sheet/set",
                  patch: { manualGrid: { ...sheet.manualGrid!, cols: Math.max(1, Math.trunc(n)) } },
                })
              }
            />
          </Field>
        </div>
      )}
    </Section>
  );
}
