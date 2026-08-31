"use client";

import { useMemo, useRef, useState, type Dispatch } from "react";
import { Button, ErrorList, Field, inputClass, Section } from "@/app/components/ui";
import type { ColumnRole, ImportFormat } from "@/lib/shift/import/detect";
import {
  detectFormat,
  guessHasHeaderRow,
  inferLongFormatColumns,
  inferWideFormatColumns,
} from "@/lib/shift/import/detect";
import { parseDelimitedText, parseHtmlTable, type ParsedGrid } from "@/lib/shift/import/parseSource";
import { parseSingleDateTimeRange } from "@/lib/shift/import/text";
import {
  buildPeopleFromLongFormat,
  buildPeopleFromWideFormat,
  resolveDate,
  type PersonDraft,
  type WideTimeColumn,
} from "@/lib/shift/import/toPeople";
import { parseWorkbookFile, type ParsedWorkbook } from "@/lib/shift/import/workbook";
import { formatDateShort } from "@/lib/shift/slots";
import type { Action } from "@/lib/shift/state";
import { createPerson } from "@/lib/shift/types";
import type { ShiftProject } from "@/lib/shift/types";

const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  name: "氏名",
  timeRange: "時刻レンジ",
  maxSlots: "上限コマ数",
  ignore: "使わない",
};

interface WideColumnDraft {
  columnIndex: number;
  enabled: boolean;
  /** "YYYY-MM-DD" 形式。未解決なら空文字 */
  date: string;
  start: string;
  end: string;
}

interface ImportDraft {
  grid: ParsedGrid;
  hasHeaderRow: boolean;
  format: ImportFormat;
  columnRoles: ColumnRole[];
  wideNameColumnIndex: number;
  wideColumns: WideColumnDraft[];
  workbook: ParsedWorkbook | null;
  sheetName: string | null;
}

function buildWideColumns(
  grid: ParsedGrid,
  nameColumnIndex: number,
  configuredDates: string[]
): WideColumnDraft[] {
  const header = grid[0] ?? [];
  return header
    .map((h, columnIndex) => {
      const parsed = parseSingleDateTimeRange(h);
      const date = parsed ? resolveDate(parsed.dateText, configuredDates) : "";
      return {
        columnIndex,
        enabled: parsed !== null,
        date,
        start: parsed?.start ?? "",
        end: parsed?.end ?? "",
      };
    })
    .filter((c) => c.columnIndex !== nameColumnIndex);
}

function computeInitialDraft(
  grid: ParsedGrid,
  workbook: ParsedWorkbook | null,
  sheetName: string | null,
  configuredDates: string[]
): ImportDraft {
  const hasHeaderRow = guessHasHeaderRow(grid);
  const format = detectFormat(grid, hasHeaderRow);
  if (format === "wide") {
    const { nameColumnIndex } = inferWideFormatColumns(grid);
    return {
      grid,
      hasHeaderRow,
      format,
      columnRoles: [],
      wideNameColumnIndex: nameColumnIndex,
      wideColumns: buildWideColumns(grid, nameColumnIndex, configuredDates),
      workbook,
      sheetName,
    };
  }
  const { columnRoles } = inferLongFormatColumns(grid, hasHeaderRow);
  return {
    grid,
    hasHeaderRow,
    format,
    columnRoles,
    wideNameColumnIndex: -1,
    wideColumns: [],
    workbook,
    sheetName,
  };
}

function recomputeForFormat(draft: ImportDraft, format: ImportFormat, configuredDates: string[]): ImportDraft {
  if (format === "wide") {
    const { nameColumnIndex } = inferWideFormatColumns(draft.grid);
    return {
      ...draft,
      format,
      wideNameColumnIndex: nameColumnIndex,
      wideColumns: buildWideColumns(draft.grid, nameColumnIndex, configuredDates),
    };
  }
  const { columnRoles } = inferLongFormatColumns(draft.grid, draft.hasHeaderRow);
  return { ...draft, format, columnRoles };
}

export function ImportPanel({
  project,
  dispatch,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
}) {
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastImportedCount, setLastImportedCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const configuredDates = useMemo(
    () => Array.from(new Set(project.slots.map((s) => s.date))).sort(),
    [project.slots]
  );

  function loadGrid(grid: ParsedGrid, workbook: ParsedWorkbook | null, sheetName: string | null) {
    setLoadError(null);
    setLastImportedCount(null);
    if (grid.length === 0 || grid.every((r) => r.every((c) => c.trim() === ""))) {
      setLoadError("読み込めるデータが見つかりませんでした。");
      setDraft(null);
      return;
    }
    setDraft(computeInitialDraft(grid, workbook, sheetName, configuredDates));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    if (html.trim() !== "") {
      const grid = parseHtmlTable(html);
      if (grid.length > 0) {
        loadGrid(grid, null, null);
        return;
      }
    }
    const text = e.clipboardData.getData("text/plain");
    const tsv = parseDelimitedText(text, "\t");
    const grid = tsv.length > 0 && tsv[0].length > 1 ? tsv : parseDelimitedText(text, ",");
    loadGrid(grid, null, null);
  }

  async function handleFile(file: File) {
    setLoadError(null);
    try {
      const workbook = await parseWorkbookFile(file);
      if (workbook.sheetNames.length === 0) {
        setLoadError("シートが見つかりませんでした。");
        return;
      }
      const sheetName = workbook.sheetNames[0];
      loadGrid(workbook.gridForSheet(sheetName), workbook, sheetName);
    } catch {
      setLoadError("ファイルを読み込めませんでした。.xlsx / .xls / .csv 形式を指定してください。");
    }
  }

  function handleSheetChange(sheetName: string) {
    if (!draft?.workbook) return;
    loadGrid(draft.workbook.gridForSheet(sheetName), draft.workbook, sheetName);
  }

  const drafts: PersonDraft[] = useMemo(() => {
    if (!draft) return [];
    if (draft.format === "long") {
      return buildPeopleFromLongFormat(draft.grid, draft.hasHeaderRow, draft.columnRoles, project.slots);
    }
    const timeColumns: WideTimeColumn[] = draft.wideColumns
      .filter((c) => c.enabled && c.date !== "" && c.start !== "" && c.end !== "" && c.start < c.end)
      .map((c) => ({ columnIndex: c.columnIndex, range: { date: c.date, start: c.start, end: c.end } }));
    return buildPeopleFromWideFormat(draft.grid, draft.wideNameColumnIndex, timeColumns, project.slots);
  }, [draft, project.slots]);

  const issueCount = drafts.reduce((sum, d) => sum + d.issues.length, 0);
  const blankNameCount = drafts.filter((d) => d.name.trim() === "").length;
  const importableCount = drafts.length - blankNameCount;

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    if (!draft) return;
    const grid = draft.grid.map((row, r) =>
      r === rowIndex ? row.map((c, ci) => (ci === colIndex ? value : c)) : row
    );
    setDraft({ ...draft, grid });
  }

  function handleCommit() {
    if (!draft) return;
    const ok = confirm(
      blankNameCount > 0
        ? `${importableCount}件を取り込みます(氏名が空欄の${blankNameCount}件はスキップされます)。現在の名簿は置き換えられます。よろしいですか?`
        : `${importableCount}件を取り込みます。現在の名簿は置き換えられます。よろしいですか?`
    );
    if (!ok) return;
    const people = drafts
      .filter((d) => d.name.trim() !== "")
      .map((d) => createPerson({ name: d.name.trim(), available: d.available, maxSlots: d.maxSlots }));
    dispatch({ type: "people/replace", people });
    setLastImportedCount(people.length);
    setDraft(null);
  }

  return (
    <div className="space-y-4">
      {project.slots.length === 0 && (
        <p className="text-xs text-amber-600">
          先に「枠設定」タブで対象日と時間枠を作成しておくと、取り込んだ時刻レンジの日付を自動で判定できます。
        </p>
      )}
      {!draft && (
        <Section title="元データの入力">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              tabIndex={0}
              onPaste={handlePaste}
              className="flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 outline-none focus:border-blue-400 focus:bg-blue-50"
            >
              <p className="font-medium">ここをクリックして Ctrl+V(⌘V)で貼り付け</p>
              <p className="mt-1 text-xs text-slate-400">
                表計算ソフトの表をコピーしてそのまま貼り付けられます。
              </p>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500"
            >
              <p className="font-medium">.xlsx / .xls / .csv をドラッグ&ドロップ</p>
              <Button onClick={() => fileRef.current?.click()}>ファイルを選択</Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {loadError && <p className="text-xs text-red-600">{loadError}</p>}
          {lastImportedCount !== null && (
            <p className="text-xs text-emerald-600">
              {lastImportedCount}件のメンバーを取り込みました。続けて追加のデータを貼り付け/選択すると、名簿が置き換わります。
            </p>
          )}
        </Section>
      )}

      {draft && (
        <>
          <Section title="読み込み設定">
            <div className="flex flex-wrap items-end gap-4">
              {draft.workbook && draft.workbook.sheetNames.length > 1 && (
                <Field label="シート">
                  <select
                    className={inputClass}
                    value={draft.sheetName ?? ""}
                    onChange={(e) => handleSheetChange(e.target.value)}
                  >
                    {draft.workbook.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.hasHeaderRow}
                  onChange={(e) => {
                    const hasHeaderRow = e.target.checked;
                    const format = detectFormat(draft.grid, hasHeaderRow);
                    setDraft(recomputeForFormat({ ...draft, hasHeaderRow }, format, configuredDates));
                  }}
                />
                先頭行はヘッダー
              </label>
              <Field label="表の形式">
                <select
                  className={inputClass}
                  value={draft.format}
                  onChange={(e) =>
                    setDraft(recomputeForFormat(draft, e.target.value as ImportFormat, configuredDates))
                  }
                >
                  <option value="long">ロング形式(1行=1人)</option>
                  <option value="wide">ワイド形式(列=時刻)</option>
                </select>
              </Field>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setLoadError(null);
                }}
              >
                やり直す
              </Button>
            </div>
          </Section>

          {draft.format === "long" ? (
            <Section title="列の割り当て" defaultOpen={false}>
              <div className="flex flex-wrap gap-3">
                {draft.columnRoles.map((role, i) => (
                  <Field key={i} label={draft.hasHeaderRow ? draft.grid[0][i] || `列${i + 1}` : `列${i + 1}`}>
                    <select
                      className={inputClass}
                      value={role}
                      onChange={(e) => {
                        const columnRoles = draft.columnRoles.map((r, ci) =>
                          ci === i ? (e.target.value as ColumnRole) : r
                        );
                        setDraft({ ...draft, columnRoles });
                      }}
                    >
                      {(Object.keys(COLUMN_ROLE_LABELS) as ColumnRole[]).map((r) => (
                        <option key={r} value={r}>
                          {COLUMN_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </Section>
          ) : (
            <Section title="列の割り当て" defaultOpen={false}>
              <Field label="氏名列">
                <select
                  className={inputClass}
                  value={draft.wideNameColumnIndex}
                  onChange={(e) => {
                    const wideNameColumnIndex = Number(e.target.value);
                    setDraft({
                      ...draft,
                      wideNameColumnIndex,
                      wideColumns: buildWideColumns(draft.grid, wideNameColumnIndex, configuredDates),
                    });
                  }}
                >
                  {(draft.grid[0] ?? []).map((h, i) => (
                    <option key={i} value={i}>
                      {h || `列${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="mt-3 space-y-2">
                <span className="text-xs font-medium text-slate-500">
                  時刻列(対象日は見出しから自動判定。必要に応じて修正してください)
                </span>
                {draft.wideColumns.map((c) => (
                  <div key={c.columnIndex} className="flex flex-wrap items-center gap-2">
                    <label className="flex w-40 shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => {
                          const wideColumns = draft.wideColumns.map((wc) =>
                            wc.columnIndex === c.columnIndex ? { ...wc, enabled: e.target.checked } : wc
                          );
                          setDraft({ ...draft, wideColumns });
                        }}
                      />
                      {draft.grid[0][c.columnIndex] || `列${c.columnIndex + 1}`}
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={c.date}
                      onChange={(e) => {
                        const wideColumns = draft.wideColumns.map((wc) =>
                          wc.columnIndex === c.columnIndex ? { ...wc, date: e.target.value } : wc
                        );
                        setDraft({ ...draft, wideColumns });
                      }}
                    />
                    <input
                      type="time"
                      className={inputClass}
                      value={c.start}
                      onChange={(e) => {
                        const wideColumns = draft.wideColumns.map((wc) =>
                          wc.columnIndex === c.columnIndex ? { ...wc, start: e.target.value } : wc
                        );
                        setDraft({ ...draft, wideColumns });
                      }}
                    />
                    <span className="text-xs text-slate-400">〜</span>
                    <input
                      type="time"
                      className={inputClass}
                      value={c.end}
                      onChange={(e) => {
                        const wideColumns = draft.wideColumns.map((wc) =>
                          wc.columnIndex === c.columnIndex ? { ...wc, end: e.target.value } : wc
                        );
                        setDraft({ ...draft, wideColumns });
                      }}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={`確認(${draft.grid.length}行)`}>
            <div className="max-h-96 overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <tbody>
                  {draft.grid.map((row, r) => {
                    const isHeader = draft.hasHeaderRow && r === 0;
                    const personDraft = draft.hasHeaderRow ? drafts[r - 1] : drafts[r];
                    const rowHasIssue = !isHeader && personDraft && personDraft.issues.length > 0;
                    return (
                      <tr
                        key={r}
                        className={
                          isHeader
                            ? "bg-slate-100 font-medium"
                            : rowHasIssue
                              ? "bg-red-50"
                              : "even:bg-slate-50/50"
                        }
                      >
                        {row.map((cell, c) => (
                          <td key={c} className="border-b border-slate-100 p-0.5">
                            <input
                              className="w-full min-w-20 rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-slate-300 focus:bg-white"
                              value={cell}
                              onChange={(e) => updateCell(r, c, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500">
              {importableCount}件を取り込み対象として検出しました
              {blankNameCount > 0 && `(氏名が空欄の${blankNameCount}件は除く)`}。
            </p>
            {issueCount > 0 && (
              <ErrorList
                errors={Array.from(
                  new Set(
                    drafts.flatMap((d) =>
                      d.issues.map((issue) => `${d.name || `${d.rowIndex + 1}行目`}: ${issue}`)
                    )
                  )
                )}
              />
            )}

            <Button variant="primary" disabled={importableCount === 0} onClick={handleCommit}>
              この内容で取り込む({importableCount}件)
            </Button>
          </Section>
        </>
      )}

      <PeopleList project={project} dispatch={dispatch} />
    </div>
  );
}

function PeopleList({ project, dispatch }: { project: ShiftProject; dispatch: Dispatch<Action> }) {
  const { people } = project;
  return (
    <Section title={`現在の名簿(${people.length}人)`} defaultOpen={people.length > 0}>
      {people.length === 0 ? (
        <p className="text-sm text-slate-400">まだメンバーが取り込まれていません。</p>
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">氏名</th>
                  <th className="py-1 pr-2 font-medium">入れる時間帯</th>
                  <th className="py-1 pr-2 font-medium">上限コマ数</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1 pr-2 whitespace-nowrap">{p.name}</td>
                    <td className="py-1 pr-2">
                      {p.available.length === 0
                        ? "なし"
                        : p.available
                            .map((r) => `${formatDateShort(r.date)} ${r.start}〜${r.end}`)
                            .join(", ")}
                    </td>
                    <td className="py-1 pr-2">{p.maxSlots ?? `既定(${project.defaultMaxSlotsPerPerson})`}</td>
                    <td className="py-1 text-right">
                      <Button variant="danger" onClick={() => dispatch({ type: "people/remove", id: p.id })}>
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("名簿をすべて削除しますか?")) dispatch({ type: "people/clear" });
            }}
          >
            全員削除
          </Button>
        </>
      )}
    </Section>
  );
}
