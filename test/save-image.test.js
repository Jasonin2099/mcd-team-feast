import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { receiptFilename, exportScale, pickDelivery, label, DOWNLOAD_ICON } from '../web/save-image.js';

test('保存图片：文件名 mcd-receipt-YYYYMMDD.png', () => {
  assert.equal(receiptFilename(new Date(2026, 9, 5)), 'mcd-receipt-20261005.png');
});
test('保存图片：缩放至少 2x 且宽度 ≥1600', () => {
  assert.equal(exportScale(1000), 2);
  assert.ok(exportScale(360) * 360 >= 1600);
  assert.ok(exportScale(390) >= 2);
  assert.equal(exportScale(0), 2);
});
test('保存图片：移动端优先分享，其次打开图片', () => {
  assert.equal(pickDelivery({ mobile: true, canShareFiles: true }), 'share');
  assert.equal(pickDelivery({ mobile: true, canShareFiles: false }), 'open');
  assert.equal(pickDelivery({ mobile: false, canShareFiles: true }), 'download');
});
test('保存图片：三种反馈状态文案 + Lucide 图标', () => {
  assert.equal(label('zh', 'busy'), '生成中…');
  assert.equal(label('zh', 'done'), '已保存');
  assert.match(label('zh', 'fail'), /重试/);
  assert.equal(label('xx', 'idle'), '保存小票图片');
  assert.match(DOWNLOAD_ICON, /<svg[\s\S]*m7 10 5 5 5-5/);
});
test('保存图片：snapDOM 已本地 vendored（无构建步骤）', () => {
  assert.match(readFileSync(new URL('../web/vendor/snapdom.mjs', import.meta.url), 'utf8'), /snapdom/);
});
