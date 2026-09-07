import { reducer, type Action } from "./state";
import { createSlotPreset, defaultShiftProject, type DailyTemplate, type ShiftProject } from "./types";
import type { ProjectsFile } from "./storage";

export type AppState = ProjectsFile;

export type AppAction =
  | { type: "projects/create" }
  | { type: "projects/duplicate"; id: string }
  | { type: "projects/delete"; id: string }
  | { type: "projects/select"; id: string | null }
  | { type: "projects/import"; project: ShiftProject }
  | { type: "projects/replaceAll"; file: ProjectsFile }
  | { type: "project"; action: Action }
  | { type: "presets/save"; name: string; template: DailyTemplate }
  | { type: "presets/remove"; id: string };

export function defaultAppState(): AppState {
  return { projects: [], activeProjectId: null, slotPresets: [] };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "projects/create": {
      const project = { ...defaultShiftProject(), id: crypto.randomUUID() };
      return { ...state, projects: [...state.projects, project], activeProjectId: project.id };
    }
    case "projects/duplicate": {
      const src = state.projects.find((p) => p.id === action.id);
      if (!src) return state;
      const copy: ShiftProject = { ...src, id: crypto.randomUUID(), name: `${src.name}のコピー` };
      const idx = state.projects.indexOf(src);
      const projects = [...state.projects];
      projects.splice(idx + 1, 0, copy);
      return { ...state, projects, activeProjectId: copy.id };
    }
    case "projects/delete": {
      const projects = state.projects.filter((p) => p.id !== action.id);
      const activeProjectId = state.activeProjectId === action.id ? null : state.activeProjectId;
      return { ...state, projects, activeProjectId };
    }
    case "projects/select":
      return { ...state, activeProjectId: action.id };
    case "projects/import": {
      const project = { ...action.project, id: crypto.randomUUID() };
      return { ...state, projects: [...state.projects, project], activeProjectId: project.id };
    }
    case "projects/replaceAll":
      return action.file;
    case "project": {
      if (!state.activeProjectId) return state;
      return {
        ...state,
        // project-scoped actions may only edit the project's content; identity (id) never changes here.
        projects: state.projects.map((p) =>
          p.id === state.activeProjectId ? { ...reducer(p, action.action), id: p.id } : p
        ),
      };
    }
    case "presets/save":
      return { ...state, slotPresets: [...state.slotPresets, createSlotPreset(action.name, action.template)] };
    case "presets/remove":
      return { ...state, slotPresets: state.slotPresets.filter((p) => p.id !== action.id) };
  }
}
