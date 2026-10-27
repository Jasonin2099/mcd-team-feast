// 浏览器脚本用的 Chrome 路径：先看 CHROME 环境变量，再按系统找常见安装位置
import fs from 'node:fs';
import path from 'node:path';

const CANDIDATES = {
  win32: ['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap(v => process.env[v]
    ? [path.join(process.env[v], 'Google/Chrome/Application/chrome.exe'), path.join(process.env[v], 'Microsoft/Edge/Application/msedge.exe')] : []),
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
};

export function chromePath(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.CHROME) return env.CHROME;
  const found = (CANDIDATES[platform] || CANDIDATES.linux).find(p => exists(p));
  if (found) return found;
  throw new Error('找不到 Chrome，请用 CHROME=<chrome 路径> 指定');
}
