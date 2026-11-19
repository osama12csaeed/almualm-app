import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string; siteUrl?: string; versionCode?: number };

export const API_BASE = extra.apiBase ?? 'https://www.almualm.com/wp-json/almualm-app/v1';
export const SITE_URL = extra.siteUrl ?? 'https://www.almualm.com';
export const VERSION_CODE = extra.versionCode ?? 1;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Content version the app last saw; added to every request so no cache serves stale data after an edit. */
let contentVersion = 0;
export function setContentVersion(v: number) {
  contentVersion = v;
}

export async function api<T>(path: string, init: RequestInit & { timeoutMs?: number; params?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(init.params ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  if (contentVersion && !path.startsWith('/config')) url.searchParams.set('v', String(contentVersion));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20000);
  try {
    const res = await fetch(url.toString(), {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError((body && typeof body.message === 'string' && body.message) || 'تعذّر الاتصال بالموقع.', res.status);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('لا يوجد اتصال بالإنترنت أو أن الموقع لا يستجيب.', 0);
  } finally {
    clearTimeout(timer);
  }
}
