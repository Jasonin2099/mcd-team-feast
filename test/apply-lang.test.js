import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { I18N } from '../web/i18n.js';

// index.html ships Chinese defaults (<html lang="zh-CN">, <title>, data-i text);
// web/app.js applyLang() must switch all of them when the user picks 中 / EN / 日.
// app.js can't be imported in Node (DOM + top-level await), so run the real
// applyLang source against a tiny fake document built from index.html.
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HTML = read('index.html');
// normalise CRLF (Windows checkouts) so the regex below matches
const APP = read('web/app.js').replace(/\r\n/g, '\n');

const src = /\nfunction applyLang\(\) \{\n[\s\S]*?\n\}\n/.exec(APP)?.[0];
const langButtons = [...HTML.matchAll(/<button data-l="(\w+)"/g)].map(m => m[1]);
const dataI = [...HTML.matchAll(/data-i="(\w+)"[^>]*>([^<]*)</g)].map(m => ({ key: m[1], text: m[2] }));
const htmlTitle = /<title>([^<]*)<\/title>/.exec(HTML)[1];

function fakeDoc() {
  const attrs = () => { const a = {}; return { a, setAttribute: (k, v) => { a[k] = String(v); } }; };
  const buttons = langButtons.map(l => ({ dataset: { l }, ...attrs() }));
  const nodes = dataI.map(({ key, text }) => ({ dataset: { i: key }, textContent: text }));
  const doc = {
    documentElement: { lang: /<html lang="([^"]+)"/.exec(HTML)[1] },
    title: htmlTitle,
    querySelectorAll: sel => sel === '#langs button' ? buttons : sel === '[data-i]' ? nodes : assert.fail('unexpected selector ' + sel),
  };
  return { doc, buttons, nodes };
}
function apply(lang, doc) {
  const t = k => I18N[lang][k] ?? I18N.zh[k];
  new Function('document', 'LANG', 't', src + '\napplyLang();')(doc, lang, t);
}

test('index.html: language buttons are exactly the I18N languages, data-i keys exist', () => {
  assert.ok(src, 'applyLang() not found in web/app.js');
  assert.deepEqual([...langButtons].sort(), Object.keys(I18N).sort());
  assert.ok(dataI.length > 0, 'expected data-i nodes in index.html');
  for (const { key } of dataI) for (const l of langButtons) assert.equal(typeof I18N[l][key], 'string', `${l}.${key}`);
});

test('applyLang: <html lang>, title, aria-pressed and data-i text follow the language', () => {
  const want = { zh: 'zh-CN', en: 'en', ja: 'ja' };
  const titles = {};
  for (const l of langButtons) {
    const { doc, buttons, nodes } = fakeDoc();
    apply(l, doc);
    assert.equal(doc.documentElement.lang, want[l], l + ' html lang');
    assert.deepEqual(buttons.map(b => b.a['aria-pressed']), langButtons.map(x => String(x === l)), l + ' aria-pressed');
    for (const n of nodes) assert.equal(n.textContent, I18N[l][n.dataset.i], `${l} data-i=${n.dataset.i}`);
    assert.ok(doc.title.trim(), l + ' title empty');
    titles[l] = doc.title;
  }
  assert.equal(titles.zh, htmlTitle, 'zh title should match the static <title> in index.html');
  assert.equal(new Set(Object.values(titles)).size, langButtons.length, 'each language needs its own title');
  assert.doesNotMatch(titles.en, /[\u4e00-\u9fff\u3040-\u30ff]{3}/, 'en title should not be CJK text');
});

test('applyLang: switching back and forth leaves no text from the previous language', () => {
  const { doc, nodes } = fakeDoc();
  for (const l of ['ja', 'en', 'zh', 'ja']) apply(l, doc);
  assert.equal(doc.documentElement.lang, 'ja');
  for (const n of nodes) assert.equal(n.textContent, I18N.ja[n.dataset.i]);
});
