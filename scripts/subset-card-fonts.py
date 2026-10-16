# 账单卡字体：JetBrains Mono（拉丁/数字）+ Noto Sans Mono CJK SC（中文），均 SIL OFL 1.1。
# 子集 = 仓库里出现的字符 + 常用汉字前 N 个（昵称够用），导出 SVG/PNG 时内嵌，所有设备显示一致。
import pathlib, subprocess, csv, io, urllib.request, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
root = pathlib.Path(__file__).resolve().parent.parent
out = root/'web/fonts'
N = int(sys.argv[1]) if len(sys.argv) > 1 else 1200
src = ''.join(p.read_text(encoding='utf-8') for p in [root/'src/card-core.js', root/'src/mock.js', root/'web/app.js', root/'web/i18n.js'])
freq_path = root/'scripts/hanzi-freq.txt'
if not freq_path.exists():
    raw = urllib.request.urlopen('https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/data/hanziDB.csv').read().decode()
    freq_path.write_text(''.join(r['charcter'] for r in csv.DictReader(io.StringIO(raw))), encoding='utf-8')
freq = freq_path.read_text(encoding='utf-8')[:N]
ascii_ = ''.join(chr(c) for c in range(0x20, 0x7f)) + '¥·—–…“”‘’×−✓→←•°'
cjk = ''.join(sorted({c for c in src + freq + '（）【】、。，！？：；《》「」·…—' if ord(c) > 0x2e7f}))
jb = '/usr/share/fonts/truetype/sand-box/google/JetBrains Mono/JetBrainsMono-VariableFont_wght.ttf'
for w in (400, 700):
    f = instancer.instantiateVariableFont(TTFont(jb), {'wght': w}); tmp = f'/tmp/jb{w}.ttf'; f.save(tmp)
    subprocess.run(['pyftsubset', tmp, f'--text={ascii_}', '--flavor=woff2', '--layout-features=kern,tnum', f'--output-file={out}/FeastMono-{w}.woff2'], check=True)
# 中文只出 400，粗体由浏览器合成，内嵌体积减半
subprocess.run(['pyftsubset', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '--font-number=7', f'--text={cjk}', '--flavor=woff2', '--no-hinting', f'--output-file={out}/FeastCJK-400.woff2'], check=True)
(out/'card-chars.txt').write_text(cjk, encoding='utf-8')
print('cjk chars', len(cjk))
