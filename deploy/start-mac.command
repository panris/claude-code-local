#!/bin/bash
# Claude Code 模型配置管理器 — Mac 启动脚本
# 双击此文件运行

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 如果从 Finder 双击运行，先打开 Terminal（否则看不到输出）
if [ ! -t 0 ]; then
    osascript -e 'tell app "Terminal" to do script "cd \"'"$SCRIPT_DIR"'\" && ./start-mac.command && read"' 2>/dev/null
    exit
fi

cd "$SCRIPT_DIR"
exec ./start.sh
