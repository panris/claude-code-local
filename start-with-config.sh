#!/bin/bash
# Claude Code + 模型配置服务器 + 动态代理组合启动脚本
# 支持模型切换无感更新

cd "$(dirname "$0")"

# 加载用户配置
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null

# 添加常见路径
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

SETTINGS_FILE="$HOME/.claude/settings.json"
ENV_FILE="$HOME/.claude/.env"

# 读取 .env 文件并导出环境变量
load_env_file() {
    if [ -f "$ENV_FILE" ]; then
        while IFS='=' read -r key value; do
            [[ "$key" =~ ^#.*$ ]] && continue
            [[ -z "$key" ]] && continue
            [[ -z "$value" ]] && continue
            export "$key=$value"
        done < "$ENV_FILE"
    fi
}

echo "📡 启动模型配置服务器..."
cd model-config-server
if [ ! -d "node_modules" ]; then
    npm install
fi
node server.js &
SERVER_PID=$!
cd ..

sleep 1

echo "🔄 启动动态代理服务器 (自动路由模型)..."
# 使用代理模式：Claude 连接 localhost:11435，代理动态转发到正确的后端
cd model-config-server
if [ ! -d "node_modules" ]; then
    npm install chokidar
fi
node proxy.js &
PROXY_PID=$!
cd ..

sleep 2

# 加载环境变量
load_env_file

echo ""
echo "════════════════════════════════════════════════════"
echo "  模型配置管理界面: http://localhost:3000"
echo "  动态代理: http://localhost:11435"
echo "  当前模型: ${CLAUDE_MODEL:-${OPENAI_MODEL:-未设置}}"
echo "════════════════════════════════════════════════════"
echo ""
echo "💡 模型切换无感更新说明："
echo "   1. 在 Web 界面切换模型"
echo "   2. 代理自动更新配置，无需重启 Claude"
echo ""

# 修改环境变量指向代理
export OPENAI_BASE_URL="http://localhost:11435"
export ANTHROPIC_API_KEY="sk-dummy"  # 代理不需要真实 key

# 启动 Claude Code
bun run dev

# Claude 退出时，停止服务
kill $SERVER_PID $PROXY_PID 2>/dev/null