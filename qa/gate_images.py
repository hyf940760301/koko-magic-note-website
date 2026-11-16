# 画面检查：逐张截图查「白屏 / 空屏」，并与上一次认可的基准图比对，找出没打算改却变了的画面
import json, os, sys
from PIL import Image, ImageStat, ImageChops
R = json.load(open('qa/gate_report.json')); res = R['results']; base = 'qa/baseline'; os.makedirs(base, exist_ok=True)
def add(g, n, ok, d=''): res.append({'group': g, 'name': n, 'ok': bool(ok), 'detail': d}); print(('  通过  ' if ok else '  不通过 ') + g + ' · ' + n + ('  — ' + d if d else ''))
blank = []; changed = []; new = 0
for s in R['shots']:
    im = Image.open(s['f']).convert('RGB').resize((320, 200), Image.BILINEAR); L = im.convert('L')
    sd = ImageStat.Stat(L).stddev[0]; h = L.histogram(); bright = sum(h[225:]) / (320 * 200)
    # 空屏：整张图几乎一个颜色；白屏：九成以上是很亮的浅色
    if sd < 6 or bright > 0.9: blank.append(f"{os.path.basename(s['f'])}（明暗起伏 {sd:.1f}，亮色占 {bright:.0%}）")
    if s['group'] in ('read', 'sizes') and 'turnmid' not in s['n'] and 'cover' not in s['n']:
        b = os.path.join(base, os.path.basename(s['f']))
        if os.path.exists(b) and '--accept' not in sys.argv:
            d = ImageChops.difference(im, Image.open(b).convert('RGB')).convert('L'); frac = sum(d.histogram()[25:]) / (320 * 200)
            if frac > 0.02: changed.append(f"{os.path.basename(s['f'])} 有 {frac:.0%} 的画面变了")
        elif not os.path.exists(b): new += 1
        if '--accept' in sys.argv or not os.path.exists(b): im.save(b)
add('C 画面', f"全部 {len(R['shots'])} 张过程截图里没有白屏、空屏", not blank, '；'.join(blank[:4]))
detail = '；'.join(changed[:4])
if '--accept' in sys.argv: detail = '已把当前画面存为新基准' + (f'（含 {new} 张新图）' if new else '')
elif new: detail = (detail + '；' if detail else '') + f'{new} 张是第一次拍，已存为基准'
add('C 画面', '静止画面与上次认可的样子一致（防止改 A 坏了 B）', not changed, detail)
bad = [r for r in res if not r['ok']]
json.dump({'results': res, 'shots': R['shots']}, open('qa/gate_report.json', 'w'), ensure_ascii=False, indent=1)
print(f"\n合计 {len(res)} 项：通过 {len(res) - len(bad)}，不通过 {len(bad)}")
for r in bad: print('  ✗ ' + r['group'] + ' · ' + r['name'] + '  — ' + r['detail'])
sys.exit(1 if bad else 0)
