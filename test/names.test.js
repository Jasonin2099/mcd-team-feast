import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clip } from '../web/text.js';

test('clip：按字符截到 10 个再加 …，emoji 算 1 个', () => {
  assert.equal(clip('测试B超长名字用来测试截断效果的同事', 10), '测试B超长名字用来测…');
  assert.equal(clip('短名字', 10), '短名字');
  assert.equal(clip('🍟🍟🍟🍟🍟🍟🍟🍟🍟🍟🍟', 10), '🍟'.repeat(10) + '…');
  assert.equal(clip('ABCDEFGHIJ', 10), 'ABCDEFGHIJ');
});
test('加入提示：名字截断，「加入了」完整（zh/en/ja）', () => {
  const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /fmt\(t\('memberJoined'\), \{ who: clip\(m\.name, 10\) \}\)/);
  const i18n = readFileSync(new URL('../web/i18n.js', import.meta.url), 'utf8');
  for (const v of ["'{who} 加入了'", "'{who} joined'", "'{who} さんが参加しました'"]) assert.ok(i18n.includes('memberJoined: ' + v));
});
test('名字单行省略、标签/状态/金额不缩；截断的名字带 title（悬停/长按看全名）', () => {
  const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /<span class="who" title="\$\{esc\(m\._n \|\| m\.name\)\}">/);
  assert.match(app, /<span class="nm" title="\$\{esc\(nameOf\(c\)\)\}">/);
  assert.match(app, /touchstart[\s\S]{0,200}\.who\[title\], \.nm\[title\]/);
  const css = readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.person-h \.n>\.who\{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(css, /\.person-h \.ps,\.person-h \.sub\{flex:none\}/);
});
