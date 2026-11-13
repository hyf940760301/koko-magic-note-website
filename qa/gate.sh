#!/bin/bash
# 交付前检查：bash qa/gate.sh        认可当前画面为新基准：bash qa/gate.sh --accept
cd "$(dirname "$0")/.." || exit 1
pkill -f "Google Chrome for Testing" 2>/dev/null; sleep 1      # 残留的测试浏览器会拖慢显卡，先清掉
curl -s -o /dev/null http://127.0.0.1:8942/index.html || { echo "本地服务没开：python3 -m http.server 8942 --bind 127.0.0.1"; exit 1; }
node qa/gate_local.mjs; code=$?
pkill -f "Google Chrome for Testing" 2>/dev/null
[ $code -eq 2 ] && echo "检查脚本超时"
python3 qa/gate_images.py "$@"
