# 把 record-demo.mjs 录的三端截图拼成 README 动画 assets/realtime-demo.webp
# 用法：NOTO_CJK_DIR=<NotoSansCJK-Bold.ttc 所在目录> python scripts/compose-demo.py <录制目录>
import json, os, pathlib, sys
from PIL import Image, ImageDraw, ImageFont

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'shots/rec')
root = pathlib.Path(__file__).resolve().parent.parent
meta = json.loads((src / 'frames.json').read_text(encoding='utf-8'))
noto = os.environ.get('NOTO_CJK_DIR', '/usr/share/fonts/opentype/noto')
bold = lambda n: ImageFont.truetype(f'{noto}/NotoSansCJK-Bold.ttc', n, index=2)    # Noto Sans CJK SC Bold
reg = lambda n: ImageFont.truetype(f'{noto}/NotoSansCJK-Regular.ttc', n, index=2)

S = 2                                    # 按 2 倍画，最后缩小一半，字更清楚
W, H = 780 * S, 550 * S
PW, GAP, TOP = 230 * S, 25 * S, 92 * S  # 手机宽、间距、手机顶部
X0 = (W - 3 * PW - 2 * GAP) // 2
BG, FG, RED, GREY = (255, 255, 255), (29, 29, 31), (218, 41, 28), (110, 110, 115)

def phone(png):
    im = Image.open(png).convert('RGB'); im = im.resize((PW, round(im.height * PW / im.width)), Image.LANCZOS)
    im = im.crop((0, 0, PW, min(im.height, H - TOP)))
    mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height + 40 * S), 14 * S, fill=255)
    return im, mask

out, durs = [], []
for i, f in enumerate(meta['frames']):
    c = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(c)
    d.text((X0, 14 * S), f['step'], font=bold(24 * S), fill=FG)
    for k, label in enumerate(meta['labels']):
        x = X0 + k * (PW + GAP)
        d.text((x, 56 * S), label, font=(bold if k == 0 else reg)(15 * S), fill=RED if k == 0 else GREY)
        im, mask = phone(src / f'f{i:04d}-{k}.png')
        d.rounded_rectangle((x - 1, TOP - 1, x + PW, H + 40 * S), 14 * S, outline=(225, 225, 228), width=S)
        c.paste(im, (x, TOP), mask)
    out.append(c.resize((W // S, H // S), Image.LANCZOS)); durs.append(f['ms'])

dst = root / 'assets/realtime-demo.webp'
out[0].save(dst, save_all=True, append_images=out[1:], duration=durs, loop=0, quality=82, method=6)
print(dst, f'{dst.stat().st_size / 1024:.0f} KB', len(out), 'frames')
