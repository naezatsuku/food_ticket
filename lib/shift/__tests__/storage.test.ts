// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter, exportProjectJson, parseImportedProject } from "../storage";
import { createRole, createTimeSlot, defaultShiftProject } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("LocalStorageAdapter", () => {
  it("何も保存されていなければ空のプロジェクト一覧を返す", async () => {
    const adapter = new LocalStorageAdapter();
    expect(await adapter.load()).toEqual({ projects: [], activeProjectId: null, slotPresets: [] });
  });

  it("保存した内容をそのまま読み込める(複数プロジェクト)", async () => {
    const adapter = new LocalStorageAdapter();
    const a = { ...defaultShiftProject(), id: "a", name: "文化祭1日目" };
    const b = { ...defaultShiftProject(), id: "b", name: "文化祭2日目" };
    await adapter.save({ projects: [a, b], activeProjectId: "b", slotPresets: [] });

    const loaded = await adapter.load();
    expect(loaded.projects.map((p) => p.name)).toEqual(["文化祭1日目", "文化祭2日目"]);
    expect(loaded.activeProjectId).toBe("b");
  });

  it("存在しないプロジェクトIDがactiveProjectIdの場合はnullに正規化する", async () => {
    const adapter = new LocalStorageAdapter();
    localStorage.setItem(
      "food-ticket-shift-projects-v1",
      JSON.stringify({ projects: [{ ...defaultShiftProject(), id: "a" }], activeProjectId: "missing" })
    );
    const loaded = await adapter.load();
    expect(loaded.activeProjectId).toBeNull();
  });

  it("Phase1〜2の単一プロジェクト形式(旧キー)からプロジェクト一覧へ1回だけ移行する", async () => {
    const legacy = {
      ...defaultShiftProject(),
      id: "legacy-1",
      name: "移行前のシフト",
      slots: [createTimeSlot()],
    };
    localStorage.setItem("food-ticket-shift-v1", JSON.stringify(legacy));

    const adapter = new LocalStorageAdapter();
    const loaded = await adapter.load();
    expect(loaded.projects).toHaveLength(1);
    expect(loaded.projects[0].name).toBe("移行前のシフト");
    expect(loaded.activeProjectId).toBe("legacy-1");
    // 旧キーは移行後に削除され、新キーに書き戻される
    expect(localStorage.getItem("food-ticket-shift-v1")).toBeNull();
    expect(localStorage.getItem("food-ticket-shift-projects-v1")).not.toBeNull();

    // 2回目の読み込みでは新キーからそのまま読み込み、重複移行しない
    const loadedAgain = await adapter.load();
    expect(loadedAgain.projects).toHaveLength(1);
  });

  it("空の(未編集の)旧データは移行しない", async () => {
    localStorage.setItem("food-ticket-shift-v1", JSON.stringify(defaultShiftProject()));
    const adapter = new LocalStorageAdapter();
    const loaded = await adapter.load();
    expect(loaded.projects).toHaveLength(0);
  });
});

describe("exportProjectJson / parseImportedProject", () => {
  it("エクスポートしたJSONをインポートすると同じ内容が復元される", () => {
    const project = {
      ...defaultShiftProject(),
      id: "p1",
      name: "文化祭",
      slots: [createTimeSlot({ id: "s1", start: "09:00", end: "09:20", capacity: 2 })],
      roles: [createRole({ name: "レジ" }, 0)],
    };
    const json = exportProjectJson(project);
    const imported = parseImportedProject(json);
    expect(imported.name).toBe("文化祭");
    expect(imported.slots).toEqual(project.slots);
    expect(imported.roles[0].name).toBe("レジ");
  });

  it("不正なJSONはエラーを投げる", () => {
    expect(() => parseImportedProject("not json")).toThrow("JSONとして読み込めませんでした");
  });
});
