#!/bin/bash
# Claude Code 一键启动脚本
# 启动配置页面 + 代理服务器 + Claude Code

set -e
cd "$(dirname "$0")"

PROXY_PORT=12655
CONFIG_PORT=3000
PID_SERVER=""
PID_PROXY=""

cleanup() {
    echo ""
    echo "🧹 停止所有服务..."
    [ -n "$PID_SERVER" ] && kill "$PID_SERVER" 2>/dev/null || true
    [ -n "$PID_PROXY" ] && kill "$PID_PROXY" 2>/dev/null || true
    wait 2>/dev/null
    echo "✅ 已停止"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Claude Code 一键启动                                ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  配置页面: http://localhost:$CONFIG_PORT"
echo "║  代理地址: http://localhost:$PROXY_PORT"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 停止旧进程
echo "🧹 清理旧进程..."
pkill -f "node.*proxy.js" 2>/dev/null || true
pkill -f "node.*server-litellm.js" 2>/dev/null || true
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

# 读取当前模型
source "$HOME/.claude/.env" 2>/dev/null || true
MODEL=${OPENAI_MODEL:-${OLLAMA_MODEL:-"未设置"}}

# 启动配置页面
echo "🎨 启动配置页面..."
node model-config-server/server-litellm.js &
PID_SERVER=$!
sleep 1

# 启动代理
echo "🚀 启动代理服务器..."
node model-config-server/proxy.js &
PID_PROXY=$!
sleep 2

# 检查启动
OK=true
if curl -s http://localhost:$PROXY_PORT/health > /dev/null 2>&1; then
    echo "✅ 代理启动成功 (PID: $PID_PROXY)"
else
    echo "❌ 代理启动失败"
    OK=false
fi

if curl -s http://localhost:$CONFIG_PORT/ > /dev/null 2>&1; then
    echo "✅ 配置页面启动成功 (PID: $PID_SERVER)"
else
    echo "⚠️  配置页面可能未启动"
fi

if [ "$OK" = false ]; then
    cleanup
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  当前模型: $MODEL"
echo "════════════════════════════════════════════════════════════"
echo ""

# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:$PROXY_PORT"
export ANTHROPIC_API_KEY="not-needed"

# 启动 Claude Code
echo "🎯 启动 Claude Code..."
echo ""
bun run dev
