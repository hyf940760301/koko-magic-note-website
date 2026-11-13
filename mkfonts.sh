#!/bin/bash
# 重新生成字体子集：收集所有 js 里出现的字符
cd "$(dirname "$0")"
python3 - <<'P'
import re,glob
s=set()
for f in glob.glob('*.js'): s|=set(open(f,encoding='utf-8').read())
s|=set('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,:;!?·-+/()（）「」，。！？：；、…—~')
open('/tmp/chars.txt','w',encoding='utf-8').write(''.join(sorted(c for c in s if c.strip() or c==' ')))
P
pyftsubset assets/fonts/wenkai.ttf --text-file=/tmp/chars.txt --flavor=woff2 --output-file=assets/fonts/wenkai_proto.woff2
pyftsubset assets/fonts/chill.ttf --text-file=/tmp/chars.txt --flavor=woff2 --output-file=assets/fonts/chill_proto.woff2
wc -m /tmp/chars.txt
