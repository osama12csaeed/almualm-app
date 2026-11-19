import { Directory, File, Paths } from 'expo-file-system';
import { actions, getState, type Download } from './store';
import { cacheKey, pruneList } from '@/lib/core';

/**
 * Every PDF the student opens is kept on the phone (so it opens instantly and
 * offline next time). Files the student "keeps" are pinned and never pruned;
 * the rest are pruned oldest-first above the size cap set in Settings.
 */

const dir = new Directory(Paths.document, 'pdfs');

function ensureDir() {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

export function localFileFor(fileId: number, url: string, version = ''): { key: string; file: File } {
  const key = cacheKey(fileId, version ? `${url}#${version}` : url);
  return { key, file: new File(dir, key) };
}

export function isDownloaded(fileId: number, url: string, version = ''): boolean {
  const { key, file } = localFileFor(fileId, url, version);
  return Boolean(getState().downloads[key]) && file.exists && file.size > 0;
}

/** Normalises Arabic file names: works whether the site sent the URL encoded or not. */
export function safeUrl(url: string): string {
  try {
    return encodeURI(decodeURI(url));
  } catch {
    return url;
  }
}

export type DownloadHandle = { promise: Promise<string>; cancel: () => void };

/**
 * One download per file at a time. The post page and the full-screen reader can ask for the same
 * PDF together: they share the download, and it is only cancelled when nobody is waiting for it.
 */
type Flight = { promise: Promise<string>; task: { cancel: () => void }; users: number; listeners: Set<(f: number) => void>; cancelled: boolean };
const inFlight = new Map<string, Flight>();

/** Returns a local file:// URI for the PDF, downloading it first if needed. */
export function getPdf(fileId: number, title: string, url: string, version = '', onProgress?: (fraction: number) => void): DownloadHandle {
  ensureDir();
  const { key, file } = localFileFor(fileId, url, version);
  const existing = getState().downloads[key];
  // An older copy of the same file (the site replaced it): keep its "pinned" choice, drop it after the new one arrives.
  const older = Object.values(getState().downloads).filter((d) => d.fileId === fileId && d.url === url && d.key !== key);
  if (existing && file.exists && file.size > 0) {
    actions.touchDownload(key);
    return { promise: Promise.resolve(file.uri), cancel: () => {} };
  }

  let flight = inFlight.get(key);
  if (!flight) {
    // A file without a store entry is a leftover from an interrupted download.
    if (file.exists) file.delete();
    const listeners = new Set<(f: number) => void>();
    const task = File.createDownloadTask(safeUrl(url), file, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) listeners.forEach((l) => l(Math.min(1, bytesWritten / totalBytes)));
      },
    });
    const f: Flight = { promise: Promise.resolve(''), task, users: 0, listeners, cancelled: false };
    f.promise = (async () => {
      try {
        let out: File | null = null;
        try {
          out = await task.downloadAsync();
        } catch (e) {
          if (file.exists) file.delete();
          throw f.cancelled ? new Error('cancelled') : e;
        }
        if (f.cancelled || !out || !file.exists || file.size === 0) {
          if (file.exists) file.delete();
          throw new Error(f.cancelled ? 'cancelled' : 'empty');
        }
        const pinned = existing?.pinned ?? older.some((d) => d.pinned);
        const entry: Download = { key, fileId, title, url, version, uri: file.uri, size: file.size, pinned, lastOpened: Date.now() };
        actions.upsertDownload(entry);
        if (older.length) removeLocal(older.map((d) => d.key));
        prune([key]);
        return file.uri;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, f);
    flight = f;
  }

  const current = flight;
  current.users++;
  if (onProgress) current.listeners.add(onProgress);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    current.users--;
    if (onProgress) current.listeners.delete(onProgress);
  };
  return {
    promise: current.promise.finally(release),
    cancel: () => {
      if (released) return;
      release();
      if (current.users <= 0 && !current.cancelled) {
        current.cancelled = true;
        try {
          current.task.cancel();
        } catch {}
      }
    },
  };
}

/** Frees space above the size cap, oldest first. `keep`: files in use right now (never removed). */
export function prune(keep: string[] = []) {
  const { downloads, settings } = getState();
  const victims = pruneList(
    Object.values(downloads).map((d) => ({ key: d.key, size: d.size, lastOpened: d.lastOpened, pinned: d.pinned || keep.includes(d.key) })),
    settings.cacheCapMB * 1024 * 1024,
  );
  removeLocal(victims);
}

export function removeLocal(keys: string[]) {
  for (const key of keys) {
    try {
      const f = new File(dir, key);
      if (f.exists) f.delete();
    } catch {}
  }
  actions.removeDownloads(keys);
}

export function totalSize(): number {
  return Object.values(getState().downloads).reduce((s, d) => s + d.size, 0);
}

/** Drops index entries whose file vanished (e.g. Android cleared app storage). */
export function reconcile() {
  const missing = Object.values(getState().downloads)
    .filter((d) => {
      try {
        return !new File(dir, d.key).exists;
      } catch {
        return true;
      }
    })
    .map((d) => d.key);
  if (missing.length) actions.removeDownloads(missing);
}
