// 梗签名：给账单卡加一句程序员梗。纯函数，CLI 与网页共用。
// 原则：不冒犯、不涉政、不贬低品牌、不暗示任何官方赞助。
export const SIGN_MAX = 36; // 按显示宽度计（中文算 2）

// tags：m 早餐 / a 下午 / n 深夜 / big 大团 / small 小团 / save 省得多 / kcal 热量高 / any 随时
const L = (zh, en, ja, tags = 'any') => ({ zh, en, ja, tags: tags.split(' ') });
export const SIGNS = [
  L('本次加班由巨无霸赞助', 'Tonight’s overtime is powered by a Big Mac', '今夜の残業はビッグマックが支えます', 'n'),
  L('git commit -m "fix: 饿"', 'git commit -m "fix: hungry"', 'git commit -m "fix: 空腹"'),
  L('先吃饭，bug 明天它自己会好', 'Eat first. The bug will fix itself tomorrow', 'まず食べよう。バグは明日勝手に直る'),
  L('今日 KPI：薯条 +1', 'Today’s KPI: fries +1', '本日の KPI：ポテト +1'),
  L('LGTM（Looks Good To Munch）', 'LGTM (Looks Good To Munch)', 'LGTM（Looks Good To Munch）'),
  L('线上事故可以等，麦旋风不行', 'Incidents can wait. The McFlurry can’t', '障害は待てる。マックフルーリーは待てない', 'a'),
  L('早餐已部署，大脑开始热启动', 'Breakfast deployed. Brain warm-booting', '朝ごはんデプロイ完了。脳がウォームブート中', 'm'),
  L('咖啡因加载完成，今天不写 bug', 'Caffeine loaded. Zero bugs today (maybe)', 'カフェイン読込完了。今日はバグを書かない', 'm'),
  L('下午三点，全员进入干饭模式', '3 p.m.: entire team in snack mode', '午後3時、全員おやつモード', 'a'),
  L('深夜食堂已上线，SLA 99.9%', 'Midnight canteen is live, SLA 99.9%', '深夜食堂リリース、SLA 99.9%', 'n'),
  L('凌晨的薯条，是写给自己的单元测试', 'Midnight fries are unit tests for the soul', '深夜のポテトは自分へのユニットテスト', 'n'),
  L('{n} 人并发下单，零冲突合并', '{n} concurrent orders, zero merge conflicts', '{n} 人同時注文、コンフリクトゼロ', 'big'),
  L('全组 {n} 人，今天谁都不许摸鱼（先吃）', '{n} people, no slacking (after lunch)', '{n} 人全員、サボり禁止（食後から）', 'big'),
  L('小团队，大胃口', 'Small team, big appetite', '少数精鋭、食欲は大規模', 'small'),
  L('省下 {save}%，这波优化可以写进周报', 'Saved {save}% — this goes in the weekly report', '{save}% 節約。週報に書ける最適化', 'save'),
  L('券的组合比算法题还难，但它算出来了', 'Coupon combos are harder than LeetCode. Solved', 'クーポンの組合せは競プロより難しい。解決済み', 'save'),
  L('钱包担当：{top}，请接受全组的 code review', 'Top spender: {top}. Please accept the team review', 'お財布担当：{top}。全員のレビューを受けよ'),
  L('{top} 贡献了最多的 commit（和卡路里）', '{top} pushed the most commits (and calories)', '{top} が最多コミット（とカロリー）'),
  L('总热量 {kcal} kcal，明天的站会改成站着开', '{kcal} kcal total. Tomorrow’s standup: actually standing', '総 {kcal} kcal。明日のスタンドアップは本当に立って', 'kcal'),
  L('热量已超出内存限制，请手动 GC', 'Calories exceeded memory limit. Please run GC', 'カロリーがメモリ上限超過。手動で GC を', 'kcal'),
  L('需求可以变，汉堡不能少', 'Requirements change. Burgers don’t', '仕様は変わる。バーガーは変わらない'),
  L('这顿饭没有技术债，只有人均', 'No tech debt here, only per-person cost', 'この食事に技術的負債はない。割り勘だけ'),
  L('能用一顿饭解决的，都不是问题', 'If lunch can fix it, it’s not a bug', 'ご飯で解決するなら、それはバグじゃない'),
  L('// TODO: 少吃点（下次一定）', '// TODO: eat less (next sprint)', '// TODO: 食べ過ぎない（次のスプリントで）'),
  L('while (hungry) { order(); }', 'while (hungry) { order(); }', 'while (hungry) { order(); }'),
  L('404：减肥计划未找到', '404: diet plan not found', '404：ダイエット計画が見つかりません', 'kcal'),
  L('已锁单，不接受 force push', 'Order locked. No force pushes', '注文確定。force push 禁止'),
  L('1024 快乐，愿你的代码像薯条一样脆', 'Happy 1024 — may your code be as crisp as fries', 'Happy 1024。コードがポテトのようにサクサクでありますように'),
  L('吃饱了才有力气 rebase', 'You need a full stomach to rebase', 'お腹いっぱいでないと rebase できない'),
  L('Ship it 之前，先 eat it', 'Eat it before you ship it', 'Ship する前に Eat する'),
  L('本单已通过全员 code review', 'This order passed team-wide code review', 'この注文は全員のコードレビュー通過済み'),
];

export function cleanSign(s) {
  let out = '', w = 0;
  for (const c of String(s ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029<>]/g, '').replace(/\s+/g, ' ').trim()) {
    const cw = c.codePointAt(0) > 255 ? 2 : 1; if (w + cw > SIGN_MAX) break; out += c; w += cw;
  }
  return out;
}

// 上下文：{ hour, n, save, top, kcal }
export function tagsFor(c = {}) {
  const t = new Set(['any']); const h = c.hour;
  if (h != null) { if (h >= 5 && h < 10) t.add('m'); else if (h >= 13 && h < 18) t.add('a'); else if (h >= 21 || h < 5) t.add('n'); }
  if (c.n >= 6) t.add('big'); else if (c.n && c.n <= 3) t.add('small');
  if (c.save >= 10) t.add('save');
  if (c.kcal >= 3000) t.add('kcal');
  return t;
}
const fill = (s, c) => s.replace('{n}', c.n ?? '').replace('{save}', c.save ?? '').replace('{top}', c.top ?? '').replace('{kcal}', c.kcal ?? '');
const usable = (x, c) => !(x.zh.includes('{top}') && !c.top) && !(x.zh.includes('{kcal}') && !c.kcal);
// 候选：上下文命中的优先，其余兜底
export function candidates(c = {}, lang = 'zh') {
  const t = tagsFor(c); const L = SIGNS.filter(x => usable(x, c));
  const hit = L.filter(x => x.tags.some(g => g !== 'any' && t.has(g))), rest = L.filter(x => !hit.includes(x) && x.tags.includes('any'));
  return [...hit, ...rest].map(x => cleanSign(fill(x[lang] || x.zh, c)));
}
// 确定性挑选（同一个团大家看到同一句），seed 变就换一句
export function pickSign(c = {}, lang = 'zh', seed = 0) {
  const list = candidates(c, lang); const hit = list.length && tagsFor(c).size > 1 ? Math.min(list.length, 6) : list.length;
  let h = 2166136261 ^ (seed >>> 0); for (const ch of String(c.key || '')) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return list[(h >>> 0) % (hit || 1)] || list[0] || '';
}
// 从 ctx 推出上下文
export function signContext(ctx) {
  const { bill, plan, now, team } = ctx;
  const hour = now?.time ? parseInt(now.time, 10) : (ctx.hour ?? null);
  const top = [...bill.people].sort((a, b) => (b.gross || b.pay) - (a.gross || a.pay))[0]?.who;
  const kcal = bill.people.reduce((s, p) => s + (p.kcal || 0), 0) || null;
  return { hour: Number.isFinite(hour) ? hour : null, n: bill.people.length, save: plan.subtotal ? Math.round(plan.discount * 100 / plan.subtotal) : 0, top, kcal, key: team?.title || '' };
}
