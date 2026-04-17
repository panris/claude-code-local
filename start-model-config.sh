#!/bin/bash
# Claude Code 模型配置管理服务器启动脚本

# 添加常见路径
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

cd "$(dirname "$0")"
cd model-config-server

# 检查 node 是否可用
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "   请确保 Node.js 已安装"
    exit 1
fi

echo "✅ 使用 Node.js: $(node --version)"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo "🚀 启动 Claude Code 模型配置管理服务器..."
echo ""

# 启动服务器
exec node server.js
