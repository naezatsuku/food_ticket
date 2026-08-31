// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDBAdapter, LocalStorageAdapter } from "../storage";
import { defaultShiftProject } from "../types";

beforeEach(() => {
  localStorage.clear();
  indexedDB = new IDBFactory();
});

describe("IndexedDBAdapter", () => {
  it("何も保存されていなければ空のプロジェクト一覧を返す", async () => {
    const adapter = new IndexedDBAdapter();
    expect(await adapter.load()).toEqual({ projects: [], activeProjectId: null, slotPresets: [] });
  });

  it("保存した内容を読み込める(複数プロジェクト・プリセット)", async () => {
    const adapter = new IndexedDBAdapter();
    const a = { ...defaultShiftProject(), id: "a", name: "文化祭1日目" };
    await adapter.save({
      projects: [a],
      activeProjectId: "a",
      slotPresets: [
        {
          id: "preset1",
          name: "いつもの構成",
          slotGeneration: { start: "09:00", end: "17:00", intervalMinutes: 20, breaks: [] },
        },
      ],
    });

    const loaded = await adapter.load();
    expect(loaded.projects.map((p) => p.name)).toEqual(["文化祭1日目"]);
    expect(loaded.activeProjectId).toBe("a");
    expect(loaded.slotPresets).toHaveLength(1);
    expect(loaded.slotPresets[0].name).toBe("いつもの構成");
  });

  it("localStorage(旧バージョン)のデータをIndexedDBへ一度だけ移行する", async () => {
    const legacyAdapter = new LocalStorageAdapter();
    const a = { ...defaultShiftProject(), id: "legacy-a", name: "移行対象" };
    await legacyAdapter.save({ projects: [a], activeProjectId: "legacy-a", slotPresets: [] });

    const adapter = new IndexedDBAdapter();
    const loaded = await adapter.load();
    expect(loaded.projects.map((p) => p.name)).toEqual(["移行対象"]);

    // 移行後は localStorage 側のキーが片付いている
    expect(localStorage.getItem("food-ticket-shift-projects-v1")).toBeNull();

    // 2回目の読み込みはIndexedDBから直接返る(再移行しない)
    const secondAdapter = new IndexedDBAdapter();
    const loadedAgain = await secondAdapter.load();
    expect(loadedAgain.projects).toHaveLength(1);
  });

  it("IndexedDBが使えない環境ではlocalStorageにフォールバックする", async () => {
    // 意図的に利用不可の状態を再現する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).indexedDB;

    const adapter = new IndexedDBAdapter();
    const a = { ...defaultShiftProject(), id: "a", name: "フォールバック" };
    await adapter.save({ projects: [a], activeProjectId: "a", slotPresets: [] });

    const loaded = await adapter.load();
    expect(loaded.projects.map((p) => p.name)).toEqual(["フォールバック"]);
    expect(localStorage.getItem("food-ticket-shift-projects-v1")).not.toBeNull();
  });
});
