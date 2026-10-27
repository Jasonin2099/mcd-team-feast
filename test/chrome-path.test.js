import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromePath } from '../scripts/chrome.mjs';

test('CHROME env wins', () => assert.equal(chromePath({ CHROME: '/x/chrome' }, 'linux', () => false), '/x/chrome'));
test('finds the first installed browser for the platform', () => {
  assert.equal(chromePath({}, 'linux', p => p === '/usr/bin/chromium'), '/usr/bin/chromium');
  assert.match(chromePath({}, 'darwin', p => p.includes('Chromium')), /Chromium\.app/);
});
test('says how to fix it when nothing is found', () => assert.throws(() => chromePath({}, 'linux', () => false), /CHROME=/));
