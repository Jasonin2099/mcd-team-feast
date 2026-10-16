// 解析 list-nutrition-foods 返回的紧凑表格：
// "[160]{productName,nutritionDescription,energyKj,energyKcal,...}:\n  猪柳麦满分,null,1288,308,..."
export function parseNutrition(data) {
  if (Array.isArray(data)) return data.map(r => ({ name: r.productName, kcal: Number(r.energyKcal) }));
  const text = String(data || ''); const m = text.match(/\{([^}]*)\}:/); if (!m) return [];
  const fields = m[1].split(','); const ni = fields.indexOf('productName'), ki = fields.indexOf('energyKcal');
  return text.slice(text.indexOf(m[0]) + m[0].length).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.split(',')).map(c => ({ name: c[ni], kcal: Number(c[ki]) })).filter(x => x.name && Number.isFinite(x.kcal));
}
const norm = s => String(s).replace(/[™®\s\-（）()]/g, '').replace(/中杯|\(中\)/g, '');
export function kcalOf(foods, name) {
  const n = norm(name);
  const hit = foods.find(f => norm(f.name) === n) || foods.find(f => n.includes(norm(f.name)) && norm(f.name).length >= 2) || foods.find(f => norm(f.name).includes(n));
  return hit ? hit.kcal : null;
}
