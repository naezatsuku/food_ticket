import type {
  Assignment,
  Person,
  Role,
  RoleRequirement,
  ShiftProject,
  SlotPreset,
  TimeSlot,
} from "./types";
import { defaultShiftProject } from "./types";

const STORAGE_KEY = "food-ticket-shift-projects-v1";
/** Phase 1〜2 で使っていた単一プロジェクト用の旧キー(移行のためだけに残す) */
const LEGACY_SINGLE_PROJECT_KEY = "food-ticket-shift-v1";

/** 保存対象1件分: プロジェクト一覧・最後に開いていたプロジェクト・枠構成のプリセット */
export interface ProjectsFile {
  projects: ShiftProject[];
  activeProjectId: string | null;
  slotPresets: SlotPreset[];
}

function defaultProjectsFile(): ProjectsFile {
  return { projects: [], activeProjectId: null, slotPresets: [] };
}

/**
 * データ保存先を抽象化するインターフェース。
 * 第1フェーズは LocalStorageAdapter のみだが、将来サーバー移行する際は
 * 同じインターフェースを満たす ApiAdapter に差し替えるだけで済む設計にしている。
 */
export interface StorageAdapter {
  load(): Promise<ProjectsFile>;
  save(file: ProjectsFile): Promise<void>;
}

function normalizeRequirement(raw: unknown): RoleRequirement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      slotId: typeof r.slotId === "string" ? r.slotId : "",
      min: typeof r.min === "number" ? r.min : 0,
      max: typeof r.max === "number" ? r.max : 0,
    }))
    .filter((r) => r.slotId !== "");
}

function normalizeSlots(raw: unknown): TimeSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : crypto.randomUUID(),
      date: typeof s.date === "string" ? s.date : "",
      start: typeof s.start === "string" ? s.start : "00:00",
      end: typeof s.end === "string" ? s.end : "00:00",
      capacity: typeof s.capacity === "number" ? s.capacity : 1,
    }));
}

function normalizeRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
      name: typeof r.name === "string" ? r.name : "",
      colorHex: typeof r.colorHex === "string" ? r.colorHex : "#3b82f6",
      requirement: normalizeRequirement(r.requirement),
    }));
}

function normalizePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      name: typeof p.name === "string" ? p.name : "",
      available: Array.isArray(p.available)
        ? p.available
            .filter(
              (a): a is { date?: unknown; start: string; end: string } =>
                typeof a === "object" &&
                a !== null &&
                typeof (a as { start?: unknown }).start === "string" &&
                typeof (a as { end?: unknown }).end === "string"
            )
            .map((a) => ({
              date: typeof a.date === "string" ? a.date : "",
              start: a.start,
              end: a.end,
            }))
        : [],
      maxSlots: typeof p.maxSlots === "number" ? p.maxSlots : null,
      rolePreference:
        typeof p.rolePreference === "object" && p.rolePreference !== null
          ? (p.rolePreference as Record<string, number>)
          : {},
    }));
}

function normalizeAssignments(raw: unknown): Assignment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      slotId: typeof a.slotId === "string" ? a.slotId : "",
      roleId: typeof a.roleId === "string" ? a.roleId : "",
      personId: typeof a.personId === "string" ? a.personId : "",
      locked: a.locked === true,
    }))
    .filter((a) => a.slotId !== "" && a.roleId !== "" && a.personId !== "");
}

/** 不明な形の入力をデフォルト値にマージして ShiftProject に正規化する */
function normalizeProject(raw: unknown): ShiftProject {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("シフトデータの形式が不正です(オブジェクトではありません)。");
  }
  const d = defaultShiftProject();
  const r = raw as Partial<ShiftProject>;
  return {
    id: typeof r.id === "string" && r.id !== "" ? r.id : crypto.randomUUID(),
    name: typeof r.name === "string" ? r.name : d.name,
    slotGeneration: {
      date: typeof r.slotGeneration?.date === "string" ? r.slotGeneration.date : d.slotGeneration.date,
      start:
        typeof r.slotGeneration?.start === "string" ? r.slotGeneration.start : d.slotGeneration.start,
      end: typeof r.slotGeneration?.end === "string" ? r.slotGeneration.end : d.slotGeneration.end,
      intervalMinutes:
        typeof r.slotGeneration?.intervalMinutes === "number"
          ? r.slotGeneration.intervalMinutes
          : d.slotGeneration.intervalMinutes,
      breaks: Array.isArray(r.slotGeneration?.breaks)
        ? r.slotGeneration.breaks.filter(
            (b): b is { start: string; end: string } =>
              typeof b === "object" &&
              b !== null &&
              typeof (b as { start?: unknown }).start === "string" &&
              typeof (b as { end?: unknown }).end === "string"
          )
        : d.slotGeneration.breaks,
    },
    slots: normalizeSlots(r.slots),
    roles: normalizeRoles(r.roles),
    people: normalizePeople(r.people),
    assignments: normalizeAssignments(r.assignments),
    defaultMaxSlotsPerPerson:
      typeof r.defaultMaxSlotsPerPerson === "number"
        ? r.defaultMaxSlotsPerPerson
        : d.defaultMaxSlotsPerPerson,
  };
}

function normalizeSlotPresets(raw: unknown): SlotPreset[] {
  if (!Array.isArray(raw)) return [];
  const d = defaultShiftProject();
  return raw
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => {
      // "template" が正式なフィールド名。旧バージョン(日付非対応時代)で
      // "slotGeneration" として保存されたプリセットも読み込めるようにする
      const g = (p.template ?? p.slotGeneration) as Partial<ShiftProject["slotGeneration"]> | undefined;
      return {
        id: typeof p.id === "string" && p.id !== "" ? p.id : crypto.randomUUID(),
        name: typeof p.name === "string" ? p.name : "",
        template: {
          start: typeof g?.start === "string" ? g.start : d.slotGeneration.start,
          end: typeof g?.end === "string" ? g.end : d.slotGeneration.end,
          intervalMinutes:
            typeof g?.intervalMinutes === "number" ? g.intervalMinutes : d.slotGeneration.intervalMinutes,
          breaks: Array.isArray(g?.breaks)
            ? g.breaks.filter(
                (b): b is { start: string; end: string } =>
                  typeof b === "object" &&
                  b !== null &&
                  typeof (b as { start?: unknown }).start === "string" &&
                  typeof (b as { end?: unknown }).end === "string"
              )
            : d.slotGeneration.breaks,
        },
      };
    });
}

/** 不明な形の入力をデフォルト値にマージして ProjectsFile に正規化する */
function normalizeProjectsFile(raw: unknown): ProjectsFile {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("シフトデータの形式が不正です(オブジェクトではありません)。");
  }
  const r = raw as Partial<ProjectsFile>;
  const projects = Array.isArray(r.projects) ? r.projects.map(normalizeProject) : [];
  const activeProjectId =
    typeof r.activeProjectId === "string" && projects.some((p) => p.id === r.activeProjectId)
      ? r.activeProjectId
      : null;
  return { projects, activeProjectId, slotPresets: normalizeSlotPresets(r.slotPresets) };
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<ProjectsFile> {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) return normalizeProjectsFile(JSON.parse(json));
    } catch {
      return defaultProjectsFile();
    }
    return this.migrateLegacySingleProject();
  }

  /** Phase 1〜2 の単一プロジェクト保存(旧キー)からの一度きりの移行 */
  private async migrateLegacySingleProject(): Promise<ProjectsFile> {
    try {
      const legacyJson = localStorage.getItem(LEGACY_SINGLE_PROJECT_KEY);
      if (!legacyJson) return defaultProjectsFile();
      const project = normalizeProject(JSON.parse(legacyJson));
      const isEmpty =
        project.name === "" &&
        project.slots.length === 0 &&
        project.roles.length === 0 &&
        project.people.length === 0;
      if (isEmpty) return defaultProjectsFile();
      const file: ProjectsFile = { projects: [project], activeProjectId: project.id, slotPresets: [] };
      await this.save(file);
      localStorage.removeItem(LEGACY_SINGLE_PROJECT_KEY);
      return file;
    } catch {
      return defaultProjectsFile();
    }
  }

  async save(file: ProjectsFile): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch {
      // 容量超過時は自動保存をあきらめる(エクスポート/インポートは引き続き使える)
    }
  }
}

const IDB_NAME = "food-ticket-shift";
const IDB_VERSION = 1;
const IDB_STORE = "projectsFile";
const IDB_RECORD_KEY = "current";

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB を使った永続化。複数プロジェクトの保存に耐えられるよう、
 * localStorage(Phase 1〜2)からこちらへ一度だけ移行する。
 * IndexedDB が使えない環境(一部のプライベートブラウジング等)では
 * localStorage にフォールバックする。
 */
export class IndexedDBAdapter implements StorageAdapter {
  private readonly fallback = new LocalStorageAdapter();

  private isAvailable(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async load(): Promise<ProjectsFile> {
    if (!this.isAvailable()) return this.fallback.load();
    try {
      const db = await openIndexedDb();
      const raw = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (raw !== undefined) return normalizeProjectsFile(raw);
    } catch {
      return this.fallback.load();
    }
    return this.migrateFromLocalStorage();
  }

  /** localStorage(旧バージョン、または旧旧の単一プロジェクト形式)からの一度きりの移行 */
  private async migrateFromLocalStorage(): Promise<ProjectsFile> {
    const file = await this.fallback.load();
    const isEmpty = file.projects.length === 0 && file.slotPresets.length === 0;
    if (isEmpty) return defaultProjectsFile();
    await this.save(file);
    localStorage.removeItem(STORAGE_KEY);
    return file;
  }

  async save(file: ProjectsFile): Promise<void> {
    if (!this.isAvailable()) return this.fallback.save(file);
    try {
      const db = await openIndexedDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(JSON.parse(JSON.stringify(file)), IDB_RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // IndexedDB利用不可時は自動保存をあきらめる(エクスポート/インポートは引き続き使える)
    }
  }
}

export function exportProjectJson(project: ShiftProject): string {
  return JSON.stringify({ app: "food-ticket-shift", version: 1, ...project }, null, 2);
}

/** JSON文字列を検証して ShiftProject を返す。不正な場合は日本語メッセージで throw */
export function parseImportedProject(json: string): ShiftProject {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("JSONとして読み込めませんでした。エクスポートしたファイルを指定してください。");
  }
  return normalizeProject(raw);
}
