"use client";

import { Fragment, useEffect, useRef, useState, type Dispatch } from "react";
import { Button, Section } from "@/app/components/ui";
import { cellOccupants, checkDropViolations, personAvailableAtSlot, unassignedPeople } from "@/lib/shift/edit";
import { requirementFor } from "@/lib/shift/roles";
import { formatDateShort } from "@/lib/shift/slots";
import type { Action, AssignmentKey } from "@/lib/shift/state";
import type { Assignment, Person, ShiftProject } from "@/lib/shift/types";

type DropTarget =
  | { kind: "cell"; slotId: string; roleId: string }
  | { kind: "pool" };

interface DragState {
  personId: string;
  personName: string;
  /** ドラッグ元。プールからなら null */
  from: { slotId: string; roleId: string } | null;
}

function findDropTarget(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest<HTMLElement>("[data-slot-id][data-role-id]");
  if (cell) {
    return { kind: "cell", slotId: cell.dataset.slotId!, roleId: cell.dataset.roleId! };
  }
  if (el.closest("[data-pool]")) return { kind: "pool" };
  return null;
}

function findHoveredPersonId(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const chip = el?.closest<HTMLElement>("[data-person-id]");
  return chip?.dataset.personId ?? null;
}

/** これ以上動いたら「クリック」ではなく「ドラッグ」とみなす移動量(px) */
const DRAG_THRESHOLD = 5;

export function EditPanel({
  project,
  dispatch,
}: {
  project: ShiftProject;
  dispatch: Dispatch<Action>;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<DropTarget | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [undoStack, setUndoStack] = useState<Assignment[][]>([]);
  const [redoStack, setRedoStack] = useState<Assignment[][]>([]);

  /** クリックされた人名カードの「複製・削除」メニューの表示先 */
  const [menuFor, setMenuFor] = useState<{ slotId: string; roleId: string; personId: string } | null>(
    null
  );
  /** 複製モード中: この人をクリックしたセルに追加配置する */
  const [copySource, setCopySource] = useState<{ personId: string; personName: string } | null>(null);
  /** ドラッグ開始前の「押下中」情報。一定距離動くまではドラッグではなくクリックとして扱う */
  const pressRef = useRef<{
    personId: string;
    personName: string;
    from: DragState["from"];
    startX: number;
    startY: number;
  } | null>(null);

  /** 割当を変更するアクションを、直前の状態をUndoスタックへ積んでからdispatchする */
  function dispatchWithUndo(action: Action) {
    setUndoStack((s) => [...s, project.assignments]);
    setRedoStack([]);
    dispatch(action);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, project.assignments]);
    dispatch({ type: "assignments/replace", assignments: prev });
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, project.assignments]);
    dispatch({ type: "assignments/replace", assignments: next });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCopySource(null);
        setMenuFor(null);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.assignments]);

  /** 人名カードの押下を記録するだけで、まだドラッグは開始しない(クリックとの区別のため) */
  function handleChipPointerDown(
    e: React.PointerEvent,
    personId: string,
    personName: string,
    from: DragState["from"]
  ) {
    e.preventDefault();
    pressRef.current = { personId, personName, from, startX: e.clientX, startY: e.clientY };
  }

  function moveFloating(x: number, y: number) {
    const el = floatingRef.current;
    if (el) el.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  }

  function finishDrag(state: DragState, x: number, y: number) {
    const target = findDropTarget(x, y);
    if (!target) return; // ドロップ先が無ければキャンセル

    if (target.kind === "pool") {
      if (!state.from) return; // 元々プールなら何もしない
      dispatchWithUndo({
        type: "assignments/remove",
        slotId: state.from.slotId,
        roleId: state.from.roleId,
        personId: state.personId,
      });
      return;
    }

    // 同じセルへのドロップは何もしない
    if (state.from && state.from.slotId === target.slotId && state.from.roleId === target.roleId) return;

    const hoveredPersonId = findHoveredPersonId(x, y);
    if (hoveredPersonId && hoveredPersonId !== state.personId) {
      // カード同士を重ねた: 入れ替え(プールから重ねた場合は、追加として扱う)
      if (!state.from) {
        applyPlace(state.personId, target);
        return;
      }
      const a: AssignmentKey = { ...state.from, personId: state.personId };
      const b: AssignmentKey = { slotId: target.slotId, roleId: target.roleId, personId: hoveredPersonId };
      dispatchWithUndo({ type: "assignments/swap", a, b });
      return;
    }

    if (state.from) {
      applyMove(state.personId, state.from, target);
    } else {
      applyPlace(state.personId, target);
    }
  }

  function confirmViolations(personId: string, target: { slotId: string; roleId: string }): boolean {
    const violations = checkDropViolations(project, personId, target);
    if (violations.length === 0) return true;
    return confirm(`${violations.map((v) => v.message).join(" / ")}\n割り当てますか?`);
  }

  function applyPlace(personId: string, target: { slotId: string; roleId: string }) {
    if (!confirmViolations(personId, target)) return;
    dispatchWithUndo({ type: "assignments/place", ...target, personId });
  }

  function applyMove(
    personId: string,
    from: { slotId: string; roleId: string },
    to: { slotId: string; roleId: string }
  ) {
    if (!confirmViolations(personId, to)) return;
    setUndoStack((s) => [...s, project.assignments]);
    setRedoStack([]);
    dispatch({ type: "assignments/remove", ...from, personId });
    dispatch({ type: "assignments/place", ...to, personId });
  }

  // finishDrag は project 等を閉じ込めた最新の関数を常に呼べるよう ref 経由で参照する
  // (下のポインタ監視 effect はマウント時の1回だけ購読するため、依存配列に含められない)
  const finishDragRef = useRef(finishDrag);
  useEffect(() => {
    finishDragRef.current = finishDrag;
  });

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (dragRef.current) {
        moveFloating(e.clientX, e.clientY);
        const target = findDropTarget(e.clientX, e.clientY);
        setHover((prev) => (JSON.stringify(prev) === JSON.stringify(target) ? prev : target));
        return;
      }
      const pending = pressRef.current;
      if (!pending) return;
      const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (moved < DRAG_THRESHOLD) return;
      // 一定距離を超えて動いたので、ここでドラッグとして開始する
      const state: DragState = { personId: pending.personId, personName: pending.personName, from: pending.from };
      dragRef.current = state;
      pressRef.current = null;
      setMenuFor(null);
      setDrag(state);
      setHover(
        pending.from ? { kind: "cell", slotId: pending.from.slotId, roleId: pending.from.roleId } : { kind: "pool" }
      );
      moveFloating(e.clientX, e.clientY);
    }

    function onUp(e: PointerEvent) {
      const current = dragRef.current;
      if (current) {
        dragRef.current = null;
        setDrag(null);
        setHover(null);
        finishDragRef.current(current, e.clientX, e.clientY);
        return;
      }
      const pending = pressRef.current;
      pressRef.current = null;
      if (!pending || !pending.from) return; // プールのカードのクリック等は何もしない
      const { slotId, roleId } = pending.from;
      const personId = pending.personId;
      // ドラッグにならなかった(=クリックされた)ので、複製・削除メニューの開閉を切り替える
      setMenuFor((prev) =>
        prev && prev.slotId === slotId && prev.roleId === roleId && prev.personId === personId
          ? null
          : { slotId, roleId, personId }
      );
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const slots = [...project.slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  );
  const pool = unassignedPeople(project);
  const personById = new Map(project.people.map((p) => [p.id, p]));

  const ready = project.slots.length > 0 && project.roles.length > 0 && project.people.length > 0;

  return (
    <div className="space-y-4" onClick={() => setMenuFor(null)}>
      <Section title="編集(ドラッグで移動・入れ替え)">
        {!ready ? (
          <p className="text-sm text-slate-400">
            枠・役割・メンバーをすべて設定すると、ここでドラッグ編集できるようになります。
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" disabled={undoStack.length === 0} onClick={undo}>
                ↩ 元に戻す(Ctrl+Z)
              </Button>
              <Button variant="ghost" disabled={redoStack.length === 0} onClick={redo}>
                ↪ やり直す(Ctrl+Y)
              </Button>
              <p className="text-xs text-slate-400">
                人名カードをドラッグしてセルへ移動、カード同士を重ねると入れ替え、プールへ戻すと未割当に戻ります。カードをクリックすると複製・削除できます。
              </p>
            </div>

            {copySource && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
                <span>
                  「{copySource.personName}」を複製中 — 割り当てたいセルを続けてクリックすると、他の枠にもまとめて割り当てられます。
                </span>
                <Button variant="primary" onClick={() => setCopySource(null)}>
                  完了
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="w-20" />
                    {project.roles.map((role) => (
                      <th key={role.id} className="px-1 py-1 text-left font-medium text-slate-600">
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: role.colorHex }}
                        />
                        {role.name || "無題"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, i) => (
                    <Fragment key={slot.id}>
                      {(i === 0 || slots[i - 1].date !== slot.date) && (
                        <tr>
                          <td
                            colSpan={project.roles.length + 1}
                            className="bg-slate-100 px-1 py-1 text-xs font-semibold text-slate-600"
                          >
                            {slot.date ? formatDateShort(slot.date) : "(日付未設定)"}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <th className="whitespace-nowrap py-1 pr-2 text-right font-normal text-slate-500">
                          {slot.start}〜{slot.end}
                        </th>
                        {project.roles.map((role) => {
                        const occupants = cellOccupants(project.assignments, {
                          slotId: slot.id,
                          roleId: role.id,
                        });
                        const capacity = requirementFor(role, slot.id).max;
                        const isHovered =
                          hover?.kind === "cell" && hover.slotId === slot.id && hover.roleId === role.id;
                        const isFull = occupants.length >= capacity && capacity > 0;
                        const dragging = drag !== null;
                        const copying = copySource !== null;
                        const activePersonId = dragging ? drag.personId : (copySource?.personId ?? null);
                        const available =
                          activePersonId !== null && personAvailableAtSlot(project, activePersonId, slot.id);
                        const highlighting = dragging || copying;

                        return (
                          <td
                            key={role.id}
                            data-slot-id={slot.id}
                            data-role-id={role.id}
                            onClick={() => {
                              if (!copySource) return;
                              // 複製モードは維持したままにして、続けて他の枠にも割り当てられるようにする
                              applyPlace(copySource.personId, { slotId: slot.id, roleId: role.id });
                            }}
                            className={[
                              "min-w-32 rounded border p-1 align-top",
                              copying ? "cursor-pointer" : "",
                              highlighting
                                ? available
                                  ? "border-emerald-300 bg-emerald-50"
                                  : "border-slate-200 bg-slate-100"
                                : "border-slate-200 bg-white",
                              isFull && highlighting ? "ring-2 ring-red-400" : "",
                              isHovered ? "outline outline-2 outline-blue-400" : "",
                            ].join(" ")}
                          >
                            <div className="flex flex-wrap gap-1">
                              {occupants.map((a) => {
                                const personName = personById.get(a.personId)?.name ?? a.personId;
                                const isMenuOpen =
                                  menuFor?.slotId === slot.id &&
                                  menuFor?.roleId === role.id &&
                                  menuFor?.personId === a.personId;
                                return (
                                  <PersonChip
                                    key={a.personId}
                                    personId={a.personId}
                                    name={personName}
                                    locked={a.locked}
                                    onPointerDown={(e) =>
                                      handleChipPointerDown(e, a.personId, personName, {
                                        slotId: slot.id,
                                        roleId: role.id,
                                      })
                                    }
                                    onToggleLock={() =>
                                      dispatch({
                                        type: "assignments/toggleLock",
                                        slotId: slot.id,
                                        roleId: role.id,
                                        personId: a.personId,
                                      })
                                    }
                                    menuOpen={isMenuOpen}
                                    onDuplicate={() => {
                                      setCopySource({ personId: a.personId, personName });
                                      setMenuFor(null);
                                    }}
                                    onDelete={() => {
                                      dispatchWithUndo({
                                        type: "assignments/remove",
                                        slotId: slot.id,
                                        roleId: role.id,
                                        personId: a.personId,
                                      });
                                      setMenuFor(null);
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {occupants.length}/{capacity}
                            </p>
                          </td>
                        );
                        })}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              data-pool="true"
              className={`rounded border p-2 ${
                hover?.kind === "pool" ? "border-blue-400 bg-blue-50" : "border-dashed border-slate-300"
              }`}
            >
              <p className="mb-1 text-xs font-medium text-slate-500">未割当プール({pool.length}人)</p>
              {pool.length === 0 ? (
                <p className="text-xs text-slate-400">全員がどこかに割り当てられています。</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {pool.map((p: Person) => (
                    <PersonChip
                      key={p.id}
                      personId={p.id}
                      name={p.name}
                      locked={false}
                      onPointerDown={(e) => handleChipPointerDown(e, p.id, p.name, null)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {drag && (
        <div
          ref={floatingRef}
          className="pointer-events-none fixed left-0 top-0 z-50 w-56 rounded-lg border border-slate-300 bg-white p-2 text-xs shadow-lg"
        >
          <p className="font-medium text-slate-800">{drag.personName}</p>
          <DragPersonDetail project={project} personId={drag.personId} />
        </div>
      )}
    </div>
  );
}

function DragPersonDetail({ project, personId }: { project: ShiftProject; personId: string }) {
  const person = project.people.find((p) => p.id === personId);
  if (!person) return null;
  const count = project.assignments.filter((a) => a.personId === personId).length;
  const max = person.maxSlots ?? project.defaultMaxSlotsPerPerson;
  return (
    <div className="mt-1 space-y-1 text-slate-500">
      <p>
        割当: {count} / {max} コマ
      </p>
      <p>
        入れる時間帯:{" "}
        {person.available.length === 0
          ? "なし"
          : person.available.map((r) => `${formatDateShort(r.date)} ${r.start}〜${r.end}`).join(", ")}
      </p>
    </div>
  );
}

function PersonChip({
  personId,
  name,
  locked,
  onPointerDown,
  onToggleLock,
  menuOpen,
  onDuplicate,
  onDelete,
}: {
  personId: string;
  name: string;
  locked: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onToggleLock?: () => void;
  /** 複製・削除メニューを表示するか(枠に配置済みのカードのみ対応) */
  menuOpen?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <span className="relative inline-block">
      <span
        data-person-id={personId}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex cursor-grab items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] active:cursor-grabbing ${
          locked ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"
        }`}
      >
        {name}
        {onToggleLock && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleLock}
            className="text-[10px] opacity-70 hover:opacity-100"
            title={locked ? "ロック解除" : "ロック"}
          >
            {locked ? "🔒" : "🔓"}
          </button>
        )}
      </span>
      {menuOpen && onDuplicate && onDelete && (
        <span className="absolute left-0 top-full z-20 mt-1 flex gap-1 whitespace-nowrap rounded border border-slate-300 bg-white p-1 shadow-md">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
          >
            複製
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-50"
          >
            削除
          </button>
        </span>
      )}
    </span>
  );
}
