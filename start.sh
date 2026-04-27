#!/bin/sh
# Claude Code 一键启动脚本（POSIX 兼容：Mac / Linux / WSL）
# 使用方法：./start.sh

set -e

cd "$(dirname "$0")"
SCRIPT_DIR="$PWD"
SERVER_DIR="$SCRIPT_DIR/model-config-server"
HOME_DIR="$HOME/.claude"

PROXY_PORT=12655
CONFIG_PORT=3000

# ── 颜色输出（检测终端支持）──────────────────────────────────────
if [ -t 1 ]; then
    BOLD='\033[1m'
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    RESET='\033[0m'
else
    BOLD='' GREEN='' RED='' YELLOW='' CYAN='' RESET=''
fi

info()    { printf "${GREEN}[OK]${RESET}   %s\n" "$1"; }
warn()    { printf "${YELLOW}[提示]${RESET} %s\n" "$1"; }
error()   { printf "${RED}[错误]${RESET} %s\n" "$1"; }
section() { printf "\n${BOLD}${CYAN}══ %s${RESET}\n\n" "$1"; }

# ── 检测 Node.js ────────────────────────────────────────────────
SECTION="环境检测"
if ! command -v node >/dev/null 2>&1; then
    error "未找到 Node.js"
    echo    "请先安装: https://nodejs.org/"
    exit 1
fi
info "Node.js: $(node --version)"
NODE_VERSION=$(node --version | sed 's/v//')
MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$MAJOR" -lt 18 ]; then
    error "Node.js 版本过低（需要 v18+）"
    exit 1
fi

# ── 检测 Claude Code 运行时 ──────────────────────────────────────
CLAUDE_RUNNER=""
if command -v bun >/dev/null 2>&1; then
    CLAUDE_RUNNER="bun run dev"
    info "运行时: bun $(bun --version 2>/dev/null || echo '')"
elif [ -f "$SCRIPT_DIR/node_modules/.bin/bun" ]; then
    CLAUDE_RUNNER="'$SCRIPT_DIR/node_modules/.bin/bun' run dev"
    info "运行时: bun (本地安装)"
elif command -v npx >/dev/null 2>&1; then
    CLAUDE_RUNNER="npx --yes @anthropic-ai/claude-code dev"
    info "运行时: npx (将下载 Claude Code)"
else
    error "未找到 bun 或 npx"
    echo    "推荐安装 bun: https://bun.sh"
    echo    "或者确保 npx 可用"
    exit 1
fi

# ── 清理旧进程 ─────────────────────────────────────────────────
section "清理旧进程"
pkill -f "node.*proxy\.js" 2>/dev/null || true
pkill -f "node.*server-litellm\.js" 2>/dev/null || true
sleep 1
info "已停止旧进程"

# ── 初始化配置目录 ───────────────────────────────────────────────
if [ ! -d "$HOME_DIR" ]; then
    mkdir -p "$HOME_DIR"
fi

# ── 打印标题 ───────────────────────────────────────────────────
section "Claude Code 模型配置管理器"
echo "  配置页面  →  http://localhost:$CONFIG_PORT"
echo "  代理服务  →  http://localhost:$PROXY_PORT"
echo "  配置文件  →  $HOME_DIR"
echo ""
echo "  Ctrl+C  停止所有服务"
echo ""

# ── 启动配置管理器 ─────────────────────────────────────────────
section "启动配置管理服务"
info "配置管理页面 → http://localhost:$CONFIG_PORT"
node "$SERVER_DIR/server-litellm.js" &
PID_SERVER=$!

# ── 启动代理 ───────────────────────────────────────────────────
info "代理服务 → http://localhost:$PROXY_PORT"
node "$SERVER_DIR/proxy.js" &
PID_PROXY=$!

sleep 2

# ── 检查启动状态 ───────────────────────────────────────────────
OK=true
if curl -sf "http://localhost:$PROXY_PORT/health" >/dev/null 2>&1; then
    info "代理启动成功 (PID: $PID_PROXY)"
else
    error "代理启动失败，请检查端口是否被占用"
    OK=false
fi

if curl -sf "http://localhost:$CONFIG_PORT/" >/dev/null 2>&1; then
    info "配置页面启动成功 (PID: $PID_SERVER)"
else
    warn "配置页面可能未启动"
fi

if [ "$OK" = false ]; then
    kill $PID_SERVER $PID_PROXY 2>/dev/null || true
    exit 1
fi

# ── 显示当前配置状态 ───────────────────────────────────────────
if [ -f "$HOME_DIR/.env" ]; then
    MODEL=$(grep '^CLAUDE_MODEL=' "$HOME_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r')
    if [ -n "$MODEL" ]; then
        info "当前模型: $MODEL"
    fi
fi

# ── 首次使用提示 ───────────────────────────────────────────────
if curl -sf "http://localhost:$CONFIG_PORT/api/status" 2>/dev/null | grep -q '"configured":true'; then
    FIRST_TIME=0
else
    FIRST_TIME=1
fi

if [ "$FIRST_TIME" = 1 ]; then
    echo ""
    warn "首次使用！请按以下步骤操作："
    echo ""
    echo "  1. 浏览器已自动打开 http://localhost:$CONFIG_PORT"
    echo "  2. 点击 [新建配置组] 添加你的 API Key"
    echo "  3. 选择服务商（推荐 [🔥 Groq] 完全免费），填入 Key"
    echo "  4. 点 [保存]，然后点 [激活]"
    echo "  5. 完成后回来按 Enter 启动 Claude Code"
    echo ""
    echo "  没有 API Key？→ https://console.groq.com （免费）"
    echo ""
    # 自动打开浏览器
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$CONFIG_PORT"
    fi
    printf '%s' "按 Enter 继续... "
    read _
fi

echo ""

# ── 启动 Claude Code ───────────────────────────────────────────
section "启动 Claude Code"
echo "  运行时命令: $CLAUDE_RUNNER"
echo ""

# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:$PROXY_PORT"
export ANTHROPIC_API_KEY="not-needed"

# 停止时清理
trap '
    echo ""
    echo "正在停止服务..."
    kill '"$PID_SERVER"' '"$PID_PROXY"' 2>/dev/null || true
    pkill -f "node.*proxy\.js" 2>/dev/null || true
    pkill -f "node.*server-litellm\.js" 2>/dev/null || true
    echo "已停止"
    exit 0
' INT TERM

# 保持运行
wait $PID_SERVER $PID_PROXY
