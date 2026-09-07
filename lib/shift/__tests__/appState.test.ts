import { describe, expect, it } from "vitest";
import { appReducer, defaultAppState } from "../appState";
import { defaultShiftProject } from "../types";

describe("appReducer", () => {
  it("projects/create はプロジェクトを追加してアクティブにする", () => {
    const state = appReducer(defaultAppState(), { type: "projects/create" });
    expect(state.projects).toHaveLength(1);
    expect(state.activeProjectId).toBe(state.projects[0].id);
  });

  it("projects/duplicate は名前に「のコピー」を付けて複製する", () => {
    let state = appReducer(defaultAppState(), { type: "projects/create" });
    state = appReducer(state, { type: "project", action: { type: "project/rename", name: "文化祭" } });
    const originalId = state.projects[0].id;
    state = appReducer(state, { type: "projects/duplicate", id: originalId });
    expect(state.projects).toHaveLength(2);
    expect(state.projects[1].name).toBe("文化祭のコピー");
    expect(state.projects[1].id).not.toBe(originalId);
    expect(state.activeProjectId).toBe(state.projects[1].id);
  });

  it("projects/delete は該当プロジェクトを削除し、アクティブなら選択解除する", () => {
    let state = appReducer(defaultAppState(), { type: "projects/create" });
    const id = state.projects[0].id;
    state = appReducer(state, { type: "projects/delete", id });
    expect(state.projects).toHaveLength(0);
    expect(state.activeProjectId).toBeNull();
  });

  it("projects/delete は非アクティブなプロジェクトを消してもアクティブ選択を維持する", () => {
    let state = appReducer(defaultAppState(), { type: "projects/create" });
    const keepId = state.activeProjectId!;
    state = appReducer(state, { type: "projects/create" });
    const removeId = state.projects.find((p) => p.id !== keepId)!.id;
    state = appReducer(state, { type: "projects/select", id: keepId });
    state = appReducer(state, { type: "projects/delete", id: removeId });
    expect(state.projects).toHaveLength(1);
    expect(state.activeProjectId).toBe(keepId);
  });

  it("projects/import は新しいIDを割り当てて追加する", () => {
    const project = { ...defaultShiftProject(), id: "external-id", name: "持ち込みデータ" };
    const state = appReducer(defaultAppState(), { type: "projects/import", project });
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].id).not.toBe("external-id");
    expect(state.projects[0].name).toBe("持ち込みデータ");
    expect(state.activeProjectId).toBe(state.projects[0].id);
  });

  it("project アクションはアクティブなプロジェクトのみを更新し、IDは変えない", () => {
    let state = appReducer(defaultAppState(), { type: "projects/create" });
    state = appReducer(state, { type: "projects/create" });
    const [first, second] = state.projects;
    state = appReducer(state, { type: "projects/select", id: first.id });
    state = appReducer(state, { type: "project", action: { type: "project/rename", name: "A" } });
    expect(state.projects.find((p) => p.id === first.id)?.name).toBe("A");
    expect(state.projects.find((p) => p.id === second.id)?.name).toBe("");
  });

  it("project の state/replace アクションでもプロジェクトのIDは維持される(初期化・インポート対策)", () => {
    let state = appReducer(defaultAppState(), { type: "projects/create" });
    const id = state.activeProjectId!;
    const replacement = { ...defaultShiftProject(), id: "someone-elses-id", name: "上書き" };
    state = appReducer(state, { type: "project", action: { type: "state/replace", project: replacement } });
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0].id).toBe(id);
    expect(state.projects[0].name).toBe("上書き");
    expect(state.activeProjectId).toBe(id);
  });

  it("アクティブなプロジェクトが無い場合、project アクションは何もしない", () => {
    const state = appReducer(defaultAppState(), {
      type: "project",
      action: { type: "project/rename", name: "A" },
    });
    expect(state).toEqual(defaultAppState());
  });
});
