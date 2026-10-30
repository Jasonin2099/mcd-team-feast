import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { I18N } from '../web/i18n.js';

// app.js falls back to zh when a key is missing (t = k => I18N[LANG][k] ?? I18N.zh[k]),
// so a missing en/ja key silently shows Chinese. These tests catch that.
const LANGS = ['zh', 'en', 'ja'];
const read = f => readFileSync(new URL('../web/' + f, import.meta.url), 'utf8');
const SRC = ['app.js', 'room-receipt.js', 'sync.js', 'text.js'].map(read).join('\n');
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const shape = v => Array.isArray(v) ? v.map(shape) : typeof v;

test('i18n: exactly zh/en/ja, same key set in each', () => {
  assert.deepEqual(Object.keys(I18N).sort(), [...LANGS].sort());
  const zh = Object.keys(I18N.zh).sort();
  for (const l of ['en', 'ja']) {
    const keys = Object.keys(I18N[l]).sort();
    assert.deepEqual(keys.filter(k => !zh.includes(k)), [], `${l} has keys zh lacks`);
    assert.deepEqual(zh.filter(k => !keys.includes(k)), [], `${l} is missing keys`);
  }
});

test('i18n: values non-empty, same {placeholders} and same table shape across languages', () => {
  for (const k of Object.keys(I18N.zh)) {
    const v = LANGS.map(l => I18N[l][k]);
    for (const [i, x] of v.entries()) {
      if (typeof x === 'string') assert.ok(x.trim(), `${LANGS[i]}.${k} is empty`);
      else assert.ok(Array.isArray(x), `${LANGS[i]}.${k} must be string or array`);
    }
    assert.deepEqual(v.map(shape), Array(3).fill(shape(v[0])), `${k}: type/shape differs`);
    const flat = x => [x].flat(Infinity).map(holes).join('|');
    assert.deepEqual(v.map(flat), Array(3).fill(flat(v[0])), `${k}: placeholders differ`);
    for (const s of v.flat(Infinity)) assert.ok(String(s).trim(), `${k}: empty cell`);
  }
});

test('i18n: every literal t(\'key\') used in web/*.js exists', () => {
  const used = new Set([...SRC.matchAll(/\bt\(\s*['"](\w+)['"]\s*\)/g)].map(m => m[1]));
  assert.ok(used.size > 50, 'expected many t() calls');
  assert.deepEqual([...used].filter(k => !(k in I18N.zh)), []);
});

test('i18n: keys built at runtime exist (try1-3, s1-3 k/t/d, how1-3 t/d, st_<status>)', () => {
  const need = [];
  for (const i of [1, 2, 3]) need.push('try' + i, `s${i}k`, `s${i}t`, `s${i}d`, `how${i}t`, `how${i}d`);
  // every status RoomSync can set (web/sync.js) plus the local-only mode
  const statuses = new Set([...read('sync.js').matchAll(/(?:status = |set\()'(\w+)'/g)].map(m => m[1]));
  for (const s of ['connecting', 'reconnecting', 'live', 'gone']) assert.ok(statuses.has(s), 'status regex missed ' + s);
  for (const s of new Set([...statuses, 'offline'])) need.push('st_' + s);
  for (const l of LANGS) assert.deepEqual(need.filter(k => !(k in I18N[l])), [], l);
});
