/**
 * Pure logic, no React Native imports, so it runs under `node --test`.
 */

/* ---------------- Ads: interstitial frequency cap ---------------- */

export type InterstitialState = { opensSinceLast: number; lastShownAt: number };

/**
 * Called each time a file is opened. Shows at most one interstitial every
 * `every` opens and never twice within `minSeconds`.
 */
export function nextInterstitial(
  state: InterstitialState,
  now: number,
  every: number,
  minSeconds: number,
): { show: boolean; state: InterstitialState } {
  const opens = state.opensSinceLast + 1;
  const spacedOut = now - state.lastShownAt >= Math.max(30, minSeconds) * 1000;
  if (every > 0 && opens >= every && spacedOut) {
    return { show: true, state: { opensSinceLast: 0, lastShownAt: now } };
  }
  return { show: false, state: { opensSinceLast: opens, lastShownAt: state.lastShownAt } };
}

/* ---------------- Updates ---------------- */

export type UpdateDecision = 'none' | 'optional' | 'required';

export function updateDecision(current: number, latest: number, min: number): UpdateDecision {
  if (current < min) return 'required';
  if (current < latest) return 'optional';
  return 'none';
}

/* ---------------- Colour ---------------- */

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function parseColor(color: string): [number, number, number] | null {
  const rgb = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return hexToRgb(color);
}

export function luminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black text, whichever reads better on `bg`. */
export function textOn(bg: string): '#ffffff' | '#0f172a' {
  return contrast('#ffffff', bg) >= contrast('#0f172a', bg) ? '#ffffff' : '#0f172a';
}

/** Darkens a colour until white text on it reaches AA (4.5:1). */
export function ensureReadableBadge(color: string | null | undefined, fallback: string): string {
  const base = color && parseColor(color) ? color : fallback;
  let rgb = parseColor(base)!;
  for (let i = 0; i < 12 && contrast('#ffffff', toHex(rgb)) < 4.5; i++) {
    rgb = rgb.map((v) => Math.round(v * 0.88)) as [number, number, number];
  }
  return toHex(rgb);
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* ---------------- Offline cache ---------------- */

export type CachedEntry = { key: string; size: number; lastOpened: number; pinned: boolean };

/** Which unpinned files to delete (oldest first) so the cache fits in `capBytes`. */
export function pruneList(entries: CachedEntry[], capBytes: number): string[] {
  let total = entries.reduce((s, e) => s + e.size, 0);
  const victims: string[] = [];
  const candidates = entries.filter((e) => !e.pinned).sort((a, b) => a.lastOpened - b.lastOpened);
  for (const e of candidates) {
    if (total <= capBytes) break;
    victims.push(e.key);
    total -= e.size;
  }
  return victims;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Stable local file name for a PDF URL. */
export function cacheKey(fileId: number, url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return `${fileId}-${h.toString(36)}.pdf`;
}

/* ---------------- Text ---------------- */

export type Block = { type: 'h' | 'p' | 'li'; text: string; href?: string } | { type: 'img'; src: string; ratio?: number };

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#8217;': '’', '&#8220;': '“', '&#8221;': '”', '&nbsp;': ' ', '&#8211;': '–' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (m, d) => (ENTITIES[m] ?? String.fromCodePoint(Number(d))))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m);
}

/** Turns the plugin's cleaned article HTML into simple blocks the app can draw natively. */
function imageBlock(tag: string): Block | null {
  const src = tag.match(/\bsrc="([^"]+)"/i)?.[1];
  if (!src || !/^https?:\/\//i.test(decodeEntities(src))) return null;
  const w = Number(tag.match(/\bwidth="(\d+)"/i)?.[1]);
  const h = Number(tag.match(/\bheight="(\d+)"/i)?.[1]);
  return { type: 'img', src: decodeEntities(src), ...(w > 0 && h > 0 ? { ratio: w / h } : {}) };
}

export function htmlToBlocks(html: string): Block[] {
  if (!html) return [];
  const out: Block[] = [];
  // Text blocks and images, in page order (an image inside a paragraph comes before its text).
  const re = /<(h[2-5]|p|li|blockquote|td|th)[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[1]) {
      const img = imageBlock(m[0]);
      if (img) out.push(img);
      continue;
    }
    const tag = m[1].toLowerCase();
    const inner = m[2];
    for (const tagImg of inner.match(/<img\b[^>]*>/gi) ?? []) {
      const img = imageBlock(tagImg);
      if (img) out.push(img);
    }
    const href = inner.match(/<a[^>]+href="([^"]+)"/i)?.[1];
    const text = decodeEntities(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
    if (!text) continue;
    out.push({ type: tag.startsWith('h') ? 'h' : tag === 'li' ? 'li' : 'p', text, ...(href ? { href: decodeEntities(href) } : {}) });
  }
  return out;
}

/** Arabic-aware search normalisation (أ/إ/آ→ا, ة→ه, ى→ي, no diacritics). */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

/** Short relative date in Arabic. */
export function relativeDate(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((now - t) / 86400000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
  if (days < 365) return `منذ ${Math.floor(days / 30)} أشهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
}
