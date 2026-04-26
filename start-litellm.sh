#!/bin/bash
# 统一模型管理启动脚本
# 使用 LiteLLM 作为底层代理，解决多模型兼容问题

set -e
cd "$(dirname "$0")"

# 配置
LITELLM_PORT=12654
WEB_UI_PORT=3000
CONFIG_FILE="$HOME/.claude/litellm_config.yaml"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Claude Code 统一模型管理系统                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  LiteLLM 代理: http://localhost:$LITELLM_PORT"
echo "║  Web 管理界面: http://localhost:$WEB_UI_PORT"
echo "║  配置文件: $CONFIG_FILE"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 确保配置文件存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "📝 创建默认配置文件..."
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << 'EOF'
# LiteLLM 配置文件
# 由 Claude Code 模型管理器自动生成

model_list:
  # Kimi 模型（示例）
  - model_name: kimi-k2.6
    litellm_params:
      model: openai/kimi-k2.6
      api_base: https://api.moonshot.cn/v1
      api_key: sk-your-kimi-api-key

general_settings:
  master_key: sk-claude-local

litellm_settings:
  drop_params: true
  set_verbose: false
EOF
    echo "✅ 配置文件已创建，请编辑添加你的 API Key"
fi

# 停止旧进程
echo "🧹 清理旧进程..."
pkill -f "litellm.*port.*$LITELLM_PORT" 2>/dev/null || true
pkill -f "node.*server.*$WEB_UI_PORT" 2>/dev/null || true
sleep 1

# 启动 LiteLLM（使用虚拟环境）
echo ""
echo "🚀 启动 LiteLLM 代理服务器..."
VENV="$HOME/.claude/litellm-venv"

if [ ! -d "$VENV" ]; then
    echo "📦 首次运行，创建虚拟环境..."
    uv venv "$VENV"
    source "$VENV/bin/activate"
    uv pip install 'litellm[proxy]'
fi

"$VENV/bin/litellm" \
    --config "$CONFIG_FILE" \
    --port $LITELLM_PORT \
    --host 127.0.0.1 \
    --drop_params \
    > /tmp/litellm.log 2>&1 &
LITELLM_PID=$!

# 等待 LiteLLM 启动
echo "⏳ 等待 LiteLLM 启动..."
for i in {1..30}; do
    if curl -s "http://localhost:$LITELLM_PORT/v1/models" -H "Authorization: Bearer sk-claude-local" > /dev/null 2>&1; then
        echo "✅ LiteLLM 启动成功 (PID: $LITELLM_PID)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ LiteLLM 启动超时，查看日志: /tmp/litellm.log"
        tail -20 /tmp/litellm.log
        exit 1
    fi
    sleep 1
done

# 启动 Web UI
echo ""
echo "🌐 启动模型管理界面..."
cd model-config-server
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
node server-litellm.js > /tmp/model-server.log 2>&1 &
SERVER_PID=$!
cd ..

sleep 2

# 显示当前模型
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  当前可用模型:"
echo "════════════════════════════════════════════════════════════"
grep "model_name:" "$CONFIG_FILE" | sed 's/.*model_name: /  • /'
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  📌 使用方法:"
echo "  ────────────────────────────────────────────────────────"
echo "  1. 浏览器打开 http://localhost:$WEB_UI_PORT 管理模型"
echo "  2. Claude Code 自动使用 http://localhost:$LITELLM_PORT"
echo ""
echo "  环境变量 (已自动设置):"
echo "    ANTHROPIC_BASE_URL=http://localhost:$LITELLM_PORT"
echo "    ANTHROPIC_API_KEY=sk-claude-local"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:$LITELLM_PORT"
export ANTHROPIC_API_KEY="sk-claude-local"
export OPENAI_BASE_URL="http://localhost:$LITELLM_PORT"
export OPENAI_API_KEY="sk-claude-local"

# 启动 Claude Code
echo "🎯 启动 Claude Code..."
bun run dev

# 退出时清理
echo ""
echo "🧹 停止服务..."
kill $LITELLM_PID $SERVER_PID 2>/dev/null || true
