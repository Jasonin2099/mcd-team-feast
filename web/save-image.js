// 保存小票图片：用 snapDOM 把小票节点导出成 PNG。
// 纯函数（文件名、缩放、状态文案）可在 Node 里测试；DOM 部分按需懒加载 snapDOM。
// 样式全部挂在 .save-img 前缀下，方便设计稿替换。

export const TARGET_WIDTH = 1600;
export const MIN_SCALE = 2;

/** mcd-receipt-YYYYMMDD.png（本地日期） */
export function receiptFilename(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `mcd-receipt-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.png`;
}

/** 至少 2x，且导出宽度 ≥ 1600px */
export function exportScale(nodeWidth, target = TARGET_WIDTH, min = MIN_SCALE) {
  const w = Number(nodeWidth) || 0;
  if (w <= 0) return min;
  return Math.max(min, Math.ceil((target / w) * 100) / 100);
}

export const STATES = {
  zh: { idle: '保存小票图片', busy: '生成中…', done: '已保存', fail: '失败，点此重试' },
  en: { idle: 'Save receipt image', busy: 'Generating…', done: 'Saved', fail: 'Failed, tap to retry' },
  ja: { idle: 'レシート画像を保存', busy: '生成中…', done: '保存しました', fail: '失敗、もう一度' },
};
export const label = (lang, s) => (STATES[lang] || STATES.zh)[s];

/** 移动端：优先系统分享面板，其次打开图片（长按保存），否则直接下载 */
export function pickDelivery({ mobile, canShareFiles }) {
  if (mobile && canShareFiles) return 'share';
  if (mobile) return 'open';
  return 'download';
}

export const DOWNLOAD_ICON = '<svg class="save-img-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>';

let snapMod;
const loadSnap = () => (snapMod ||= import('./vendor/snapdom.mjs'));

export async function nodeToPngBlob(node) {
  const { snapdom } = await loadSnap();
  const w = node.getBoundingClientRect().width;
  return snapdom.toBlob(node, { type: 'png', scale: exportScale(w), backgroundColor: '#ffffff', embedFonts: true });
}

function deliver(blob, name, mode) {
  const url = URL.createObjectURL(blob);
  if (mode === 'open') { const w = window.open(url, '_blank'); if (!w) location.href = url; }
  else { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** 在 target 节点后插入按钮；getNode 返回要导出的节点 */
export function mountSaveButton(host, getNode, { lang = 'zh', onBlob } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'save-img'; btn.dataset.state = 'idle';
  const set = s => { btn.dataset.state = s; btn.disabled = s === 'busy'; btn.innerHTML = `${DOWNLOAD_ICON}<span>${label(lang, s)}</span>`; };
  set('idle');
  btn.addEventListener('click', async () => {
    if (btn.dataset.state === 'busy') return;
    set('busy');
    try {
      const blob = await nodeToPngBlob(getNode());
      const name = receiptFilename();
      onBlob?.(blob, name);
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      const mobile = matchMedia('(pointer: coarse)').matches && innerWidth < 820;
      const mode = pickDelivery({ mobile, canShareFiles: !!(file && navigator.canShare?.({ files: [file] })) });
      if (mode === 'share') { try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') deliver(blob, name, 'open'); } }
      else deliver(blob, name, mode);
      set('done'); setTimeout(() => btn.dataset.state === 'done' && set('idle'), 2400);
    } catch (e) { console.warn('[save-img]', e); set('fail'); }
  });
  host.appendChild(btn);
  return btn;
}
