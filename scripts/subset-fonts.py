# 从系统 Noto Sans CJK 中按网页实际用到的字符子集化，输出 woff2（SIL OFL 1.1）
import re, subprocess, sys, pathlib, json, os
root = pathlib.Path(__file__).resolve().parent.parent
src = ''.join(p.read_text(encoding='utf-8') for p in [root/'index.html', root/'web/app.js', root/'web/i18n.js', root/'src/mock.js', root/'src/card-core.js', root/'src/signatures.js'])
ja = (root/'web/i18n.js').read_text(encoding='utf-8')
ja = ja[ja.index('  ja: {'):]
base = ''.join(chr(c) for c in range(0x20, 0x7f)) + '¥·—–…“”‘’「」『』（）【】、。，！？：；《》→←‹›×−✓★◐🔒'
sc_chars = ''.join(sorted(set(base + src)))
jp_chars = ''.join(sorted(set(base + ja)))
# NOTO_CJK_DIR：NotoSansCJK-Regular/Bold.ttc 所在目录（notofonts/noto-cjk 的 Sans/OTC）
NOTO = os.environ.get('NOTO_CJK_DIR', '/usr/share/fonts/opentype/noto')
out = root/'web/fonts'; out.mkdir(parents=True, exist_ok=True)
for weight, f in [('400', 'Regular'), ('700', 'Bold')]:
    ttc = f'{NOTO}/NotoSansCJK-{f}.ttc'
    for name, idx, chars in [('SC', 2, sc_chars), ('JP', 0, jp_chars)]:
        subprocess.run(['pyftsubset', ttc, f'--font-number={idx}', f'--text={chars}', '--flavor=woff2', '--no-hinting',
                        f'--output-file={out}/NotoSans{name}-{weight}.woff2'], check=True)
print(len(sc_chars), len(jp_chars))
