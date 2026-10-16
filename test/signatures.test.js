import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS, cleanSign, candidates, pickSign, tagsFor, SIGN_MAX } from '../src/signatures.js';
import { renderSVG } from '../src/card-core.js';
import { width } from '../src/card-core.js';

test('signatures: ~30 curated lines in zh/en/ja', () => {
  assert.ok(SIGNS.length >= 28);
  for (const s of SIGNS) for (const l of ['zh', 'en', 'ja']) assert.ok(s[l] && !/[<>]/.test(s[l]), s.zh);
});
test('signatures: sanitize custom text (no markup, length cap)', () => {
  const v = cleanSign('<img src=x onerror=alert(1)>\n' + '饿'.repeat(50));
  assert.ok(!/[<>\n]/.test(v)); assert.ok(width(v) <= SIGN_MAX);
});
test('signatures: context aware and deterministic', () => {
  assert.ok(tagsFor({ hour: 8 }).has('m')); assert.ok(tagsFor({ hour: 23 }).has('n')); assert.ok(tagsFor({ n: 8 }).has('big'));
  const c = { hour: 15, n: 5, save: 20, top: '老王', kcal: 3200, key: 'room1' };
  assert.equal(pickSign(c, 'zh', 3), pickSign(c, 'zh', 3));
  assert.ok(candidates(c).slice(0, 6).some(x => /下午|麦旋风|省下|券|kcal|热量|减肥/.test(x)));
  assert.ok(!candidates({ n: 2 }).some(x => /\{(n|save|top|kcal)\}/.test(x) || x.includes('undefined')));
});
test('card: signature + repo QR watermark in all themes, escaped', () => {
  const ctx = { team: { title: 't', organizer: 'a', createdAt: '2026-10-24T07:00:00.000Z', store: { storeName: 's', storeCode: 'X' }, picks: [] }, bill: { people: [{ who: 'a', pay: 100, items: ['x×1'] }], avg: 100 }, plan: { subtotal: 100, discount: 0, total: 100, applied: [] }, mode: 'mock', sign: 'a & b "c"' };
  for (const th of ['git', 'pr', 'receipt']) { const svg = renderSVG(ctx, th); assert.ok(svg.includes('a &amp; b &quot;c&quot;'), th); assert.ok(svg.includes('github.com/Jasonin2099/mcd-team-feast'), th); assert.ok(svg.includes('crispEdges'), th + ' qr'); }
});
