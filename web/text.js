/** 按字符截断（emoji/汉字算 1 个），超出加 … */
export const clip = (s, n) => { const a = Array.from(String(s ?? '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); };
