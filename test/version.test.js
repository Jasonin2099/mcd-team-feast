import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/version.js';

test('VERSION 与 package.json 一致', () => {
  assert.equal(VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});

// 网页直接加载 ES 模块，引用链里出现 node: 内置模块就整页白屏（v0.2.1 的 version.js 踩过）
test('网页的模块引用链里没有 node: 内置模块', () => {
  const seen = new Set(), bad = [];
  const walk = url => {
    const key = url.href.split('?')[0]; if (seen.has(key)) return; seen.add(key);
    const src = readFileSync(new URL(key), 'utf8');
    for (const [, a, b] of src.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
      const spec = a || b;
      if (/^node:|^(fs|path|os|child_process|url)$/.test(spec)) bad.push(`${key.replace(/.*mcd-team-feast\//, '')} → ${spec}`);
      else if (spec.startsWith('.')) walk(new URL(spec, key));
    }
  };
  walk(new URL('../web/app.js', import.meta.url));
  assert.ok(seen.size > 5, `只走到 ${seen.size} 个模块，正则可能失效`);
  assert.deepEqual(bad, []);
});
