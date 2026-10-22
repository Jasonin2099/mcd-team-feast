# 账单卡字体：JetBrains Mono（拉丁/数字）+ Noto Sans Mono CJK SC（中文），均 SIL OFL 1.1。
# 子集 = 仓库里出现的字符 + 常用汉字前 N 个（昵称够用），导出 SVG/PNG 时内嵌，所有设备显示一致。
import pathlib, subprocess, csv, io, urllib.request, sys, os, tempfile
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
root = pathlib.Path(__file__).resolve().parent.parent
out = root/'web/fonts'
N = int(sys.argv[1]) if len(sys.argv) > 1 else 1200
src = ''.join(p.read_text(encoding='utf-8') for p in [root/'src/card-core.js', root/'src/mock.js', root/'src/signatures.js', root/'web/app.js', root/'web/i18n.js'])
freq_path = root/'scripts/hanzi-freq.txt'
if not freq_path.exists():
    raw = urllib.request.urlopen('https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/data/hanziDB.csv').read().decode()
    freq_path.write_text(''.join(r['charcter'] for r in csv.DictReader(io.StringIO(raw))), encoding='utf-8')
freq = freq_path.read_text(encoding='utf-8')[:N]
ascii_ = ''.join(chr(c) for c in range(0x20, 0x7f)) + '¥·—–…“”‘’×−✓→←•°'
cjk = ''.join(sorted({c for c in src + freq + '（）【】、。，！？：；《》「」·…—' if ord(c) > 0x2e7f}))
# 字体路径可用环境变量覆盖（Windows/macOS 上指向下载的原始字体）
jb = os.environ.get('JETBRAINS_MONO', '/usr/share/fonts/truetype/sand-box/google/JetBrains Mono/JetBrainsMono-VariableFont_wght.ttf')
noto = os.environ.get('NOTO_CJK_DIR', '/usr/share/fonts/opentype/noto')
if pathlib.Path(jb).exists():
    for w in (400, 700):
        f = instancer.instantiateVariableFont(TTFont(jb), {'wght': w}); tmp = str(pathlib.Path(tempfile.gettempdir())/f'jb{w}.ttf'); f.save(tmp)
        subprocess.run(['pyftsubset', tmp, f'--text={ascii_}', '--flavor=woff2', '--layout-features=kern,tnum', f'--output-file={out}/FeastMono-{w}.woff2'], check=True)
else:
    print('skip FeastMono: JetBrains Mono not found (Latin subset is fixed ASCII, usually unchanged)')
# 中文只出 400，粗体由浏览器合成，内嵌体积减半
subprocess.run(['pyftsubset', f'{noto}/NotoSansCJK-Regular.ttc', '--font-number=7', f'--text={cjk}', '--flavor=woff2', '--no-hinting', f'--output-file={out}/FeastCJK-400.woff2'], check=True)
(out/'card-chars.txt').write_text(cjk, encoding='utf-8')
print('cjk chars', len(cjk))
