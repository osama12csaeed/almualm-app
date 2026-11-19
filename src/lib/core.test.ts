import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextInterstitial, updateDecision, contrast, textOn, ensureReadableBadge, pruneList,
  formatBytes, cacheKey, htmlToBlocks, normalizeArabic, relativeDate,
} from './core.ts';

test('interstitial: every N opens, never closer than minSeconds', () => {
  let s = { opensSinceLast: 0, lastShownAt: 0 };
  const shown: number[] = [];
  let now = 1_000_000;
  for (let i = 1; i <= 12; i++) {
    now += 60_000; // one file per minute
    const r = nextInterstitial(s, now, 4, 180);
    s = r.state;
    if (r.show) shown.push(i);
  }
  assert.deepEqual(shown, [4, 8, 12]);

  // Fast opens: 4 files in 20 seconds → still waits for the time gap.
  s = { opensSinceLast: 0, lastShownAt: now };
  let any = false;
  for (let i = 0; i < 4; i++) {
    now += 5_000;
    const r = nextInterstitial(s, now, 4, 180);
    s = r.state;
    any ||= r.show;
  }
  assert.equal(any, false);
});

test('interstitial: minimum 30 s even if admin sets less, off when every=0', () => {
  const r = nextInterstitial({ opensSinceLast: 10, lastShownAt: 0 }, 10_000, 1, 1);
  assert.equal(r.show, false);
  assert.equal(nextInterstitial({ opensSinceLast: 99, lastShownAt: 0 }, 1e12, 0, 60).show, false);
});

test('update decision', () => {
  assert.equal(updateDecision(1, 1, 1), 'none');
  assert.equal(updateDecision(1, 3, 1), 'optional');
  assert.equal(updateDecision(1, 3, 2), 'required');
});

test('contrast and readable badges', () => {
  assert.ok(contrast('#000000', '#ffffff') > 20);
  assert.equal(textOn('#1d4ed8'), '#ffffff');
  assert.equal(textOn('#fde68a'), '#0f172a');
  // The site's grey badge (#9ca3af) is too light for white text → darkened to AA.
  const fixed = ensureReadableBadge('#9ca3af', '#475569');
  assert.ok(contrast('#ffffff', fixed) >= 4.5, fixed);
  assert.equal(ensureReadableBadge('#1d4ed8', '#000'), '#1d4ed8');
  assert.ok(contrast('#ffffff', ensureReadableBadge('rgb(250, 204, 21)', '#000')) >= 4.5);
  assert.equal(ensureReadableBadge('nonsense', '#475569'), '#475569');
});

test('offline cache pruning keeps pinned files and drops the oldest', () => {
  const victims = pruneList(
    [
      { key: 'a', size: 50, lastOpened: 1, pinned: true },
      { key: 'b', size: 50, lastOpened: 2, pinned: false },
      { key: 'c', size: 50, lastOpened: 3, pinned: false },
      { key: 'd', size: 50, lastOpened: 4, pinned: false },
    ],
    120,
  );
  assert.deepEqual(victims, ['b', 'c']);
  assert.deepEqual(pruneList([{ key: 'x', size: 500, lastOpened: 1, pinned: true }], 100), []);
});

test('bytes and cache keys', () => {
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(2048), '2.0 ك.ب');
  assert.equal(formatBytes(15 * 1024 * 1024), '15 م.ب');
  assert.equal(cacheKey(5, 'https://x/a.pdf'), cacheKey(5, 'https://x/a.pdf'));
  assert.notEqual(cacheKey(5, 'https://x/a.pdf'), cacheKey(5, 'https://x/b.pdf'));
  assert.match(cacheKey(5, 'https://x/ملف.pdf'), /^5-[0-9a-z]+\.pdf$/);
});

test('html → blocks keeps text, drops tags, decodes entities', () => {
  const blocks = htmlToBlocks('<h2>الوحدة الأولى</h2><p>علم الكيمياء:<br>هو العلم &amp; المادة</p><ul><li>بند</li></ul><p> </p><p><a href="https://x/y.pdf">تحميل</a></p>');
  assert.deepEqual(blocks, [
    { type: 'h', text: 'الوحدة الأولى' },
    { type: 'p', text: 'علم الكيمياء:\nهو العلم & المادة' },
    { type: 'li', text: 'بند' },
    { type: 'p', text: 'تحميل', href: 'https://x/y.pdf' },
  ]);
});

test('arabic normalisation for search', () => {
  assert.equal(normalizeArabic('الكيمياءُ أولى'), normalizeArabic('الكيمياء اولي'));
  assert.equal(normalizeArabic('مكتبة'), 'مكتبه');
});

test('relative dates', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  assert.equal(relativeDate('2026-11-19T08:00:00Z', now), 'اليوم');
  assert.equal(relativeDate('2026-11-18T08:00:00Z', now), 'أمس');
  assert.equal(relativeDate('2026-10-01T08:00:00Z', now), 'منذ 1 أشهر');
  assert.equal(relativeDate(null, now), '');
});
