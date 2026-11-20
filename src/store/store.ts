import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { FileSummary, NodeSummary } from '@/api/types';
import type { InterstitialState } from '@/lib/core';

export type ThemeChoice = 'system' | 'light' | 'dark' | null;

export type SavedFile = Pick<FileSummary, 'id' | 'title' | 'badge' | 'badge_color' | 'thumb'> & { savedAt: number };
export type SavedNode = Pick<NodeSummary, 'id' | 'title' | 'image'> & { savedAt: number; subtitle?: string };
export type Progress = { fileId: number; title: string; badge: string; pdfIndex: number; page: number; total: number; updatedAt: number };
export type Download = { key: string; fileId: number; title: string; url: string; version?: string; uri: string; size: number; pinned: boolean; lastOpened: number };

export type State = {
  hydrated: boolean;
  settings: {
    theme: ThemeChoice; // null = follow wp-admin default
    rootId: number | null; // chosen curriculum
    gradeId: number | null; // remembered grade for the home screen
    notifications: boolean;
    cacheCapMB: number;
    fitWidth: boolean;
    saveDirUri: string | null; // folder the student picked for «تحميل PDF»
    commentName: string;
    commentEmail: string;
    /** Neutral age screen before commenting (Google Play Families policy). null = not asked yet. */
    birthYear: number | null;
  };
  favFiles: Record<string, SavedFile>;
  favNodes: Record<string, SavedNode>;
  progress: Record<string, Progress>;
  downloads: Record<string, Download>;
  ads: InterstitialState;
  lastSeenNotice: number;
};

const KEY = 'almualm-store-v1';

const initial: State = {
  hydrated: false,
  settings: { theme: null, rootId: null, gradeId: null, notifications: true, cacheCapMB: 400, fitWidth: true, saveDirUri: null, commentName: '', commentEmail: '', birthYear: null },
  favFiles: {},
  favNodes: {},
  progress: {},
  downloads: {},
  ads: { opensSinceLast: 0, lastShownAt: 0 },
  lastSeenNotice: 0,
};

let state: State = initial;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { hydrated, ...rest } = state;
    AsyncStorage.setItem(KEY, JSON.stringify(rest)).catch(() => {});
  }, 300);
}

export function getState() {
  return state;
}

export function setState(update: (s: State) => Partial<State>) {
  state = { ...state, ...update(state) };
  emit();
  persist();
}

export async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      state = { ...initial, ...saved, settings: { ...initial.settings, ...(saved.settings ?? {}) }, hydrated: true };
    } else {
      state = { ...initial, hydrated: true };
    }
  } catch {
    state = { ...initial, hydrated: true };
  }
  emit();
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(state),
  );
}

/* ---------------- actions ---------------- */

export const actions = {
  setSettings(patch: Partial<State['settings']>) {
    setState((s) => ({ settings: { ...s.settings, ...patch } }));
  },

  toggleFavFile(file: Pick<FileSummary, 'id' | 'title' | 'badge' | 'badge_color' | 'thumb'>) {
    setState((s) => {
      const favFiles = { ...s.favFiles };
      if (favFiles[file.id]) delete favFiles[file.id];
      else favFiles[file.id] = { id: file.id, title: file.title, badge: file.badge, badge_color: file.badge_color, thumb: file.thumb, savedAt: Date.now() };
      return { favFiles };
    });
  },

  toggleFavNode(node: Pick<NodeSummary, 'id' | 'title' | 'image'>, subtitle?: string) {
    setState((s) => {
      const favNodes = { ...s.favNodes };
      if (favNodes[node.id]) delete favNodes[node.id];
      else favNodes[node.id] = { id: node.id, title: node.title, image: node.image, subtitle, savedAt: Date.now() };
      return { favNodes };
    });
  },

  saveProgress(p: Omit<Progress, 'updatedAt'>) {
    setState((s) => ({ progress: { ...s.progress, [p.fileId]: { ...p, updatedAt: Date.now() } } }));
  },

  clearProgress(fileId: number) {
    setState((s) => {
      const progress = { ...s.progress };
      delete progress[fileId];
      return { progress };
    });
  },

  upsertDownload(d: Download) {
    setState((s) => ({ downloads: { ...s.downloads, [d.key]: d } }));
  },

  touchDownload(key: string) {
    setState((s) => (s.downloads[key] ? { downloads: { ...s.downloads, [key]: { ...s.downloads[key], lastOpened: Date.now() } } } : {}));
  },

  setPinned(key: string, pinned: boolean) {
    setState((s) => (s.downloads[key] ? { downloads: { ...s.downloads, [key]: { ...s.downloads[key], pinned } } } : {}));
  },

  removeDownloads(keys: string[]) {
    setState((s) => {
      const downloads = { ...s.downloads };
      keys.forEach((k) => delete downloads[k]);
      return { downloads };
    });
  },

  setAds(ads: InterstitialState) {
    setState(() => ({ ads }));
  },

  setLastSeenNotice(id: number) {
    setState((s) => ({ lastSeenNotice: Math.max(s.lastSeenNotice, id) }));
  },
};
