#!/bin/bash

# Claude Code 模型配置管理服务器启动脚本 (Bun 版本)

cd "$(dirname "$0")"

# 检查 bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "❌ 错误: 未找到 Bun，请先安装 Bun"
    echo "   安装命令: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# 启动服务器
echo "🚀 启动 Claude Code 模型配置管理服务器..."
bun run server-bun.ts
