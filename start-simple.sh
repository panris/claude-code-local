#!/bin/bash
# Claude Code 简易启动脚本
# 使用本地 proxy.js 转换 Anthropic/OpenAI 协议

set -e
cd "$(dirname "$0")"

PORT=12654

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Claude Code 模型代理                                 ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  代理地址: http://localhost:$PORT"
echo "║  支持格式: Anthropic /v1/messages"
echo "║           OpenAI    /v1/chat/completions"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 停止旧进程
echo "🧹 清理旧进程..."
pkill -f "node.*proxy.js" 2>/dev/null || true
sleep 1

# 检查配置
if [ ! -f "$HOME/.claude/.env" ]; then
    echo "❌ 配置文件不存在: ~/.claude/.env"
    echo ""
    echo "请创建配置文件，示例："
    echo ""
    echo "  OPENAI_API_KEY=your-api-key"
    echo "  OPENAI_BASE_URL=https://api.moonshot.cn/v1"
    echo "  OPENAI_MODEL=kimi-k2.6"
    echo ""
    exit 1
fi

# 启动代理
echo "🚀 启动代理服务器..."
node model-config-server/proxy.js &
PROXY_PID=$!
sleep 2

# 检查启动
if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "✅ 代理启动成功 (PID: $PROXY_PID)"
else
    echo "❌ 代理启动失败"
    exit 1
fi

# 显示当前模型
source "$HOME/.claude/.env" 2>/dev/null || true
MODEL=${OPENAI_MODEL:-${OLLAMA_MODEL:-"未设置"}}
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  当前模型: $MODEL"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  📌 使用方法:"
echo "  ────────────────────────────────────────────────────────"
echo "  设置环境变量:"
echo "    export ANTHROPIC_BASE_URL=http://localhost:$PORT"
echo "    export ANTHROPIC_API_KEY=not-needed"
echo ""
echo "  然后启动 Claude Code:"
echo "    bun run dev"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:$PORT"
export ANTHROPIC_API_KEY="not-needed"

# 启动 Claude Code
echo "🎯 启动 Claude Code..."
bun run dev

# 退出时清理
trap "echo ''; echo '🧹 停止服务...'; kill $PROXY_PID 2>/dev/null; exit 0" SIGINT SIGTERM
