#!/bin/bash
# Claude Code 模型配置启动脚本
# 从 settings.json 读取配置并导出环境变量

cd "$(dirname "$0")"

# 加载用户配置
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" 2>/dev/null

# 添加常见路径
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

SETTINGS_FILE="$HOME/.claude/settings.json"

# 读取 settings.json 并导出环境变量
export_env_from_settings() {
    if [ ! -f "$SETTINGS_FILE" ]; then
        echo "⚠️  未找到 settings.json: $SETTINGS_FILE"
        return
    fi
    
    # 使用 node 读取 JSON
    if command -v node &> /dev/null; then
        # 获取当前激活配置的完整信息
        CONFIG_JSON=$(node -e "
            const fs = require('fs');
            const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
            const configs = settings.modelConfigs || [];
            const activeName = settings.activeModelConfig;
            const active = configs.find(c => c.name === activeName);
            
            if (active) {
                console.log(JSON.stringify({
                    name: active.name,
                    provider: active.provider,
                    apiKey: active.apiKey,
                    baseUrl: active.baseUrl,
                    model: active.activeModel || (active.models && active.models[0]) || settings.model || '',
                    modelType: active.provider
                }));
            } else {
                console.log(JSON.stringify({
                    model: settings.model || '',
                    modelType: settings.modelType || ''
                }));
            }
        ")
        
        if [ -n "$CONFIG_JSON" ]; then
            NAME=$(echo "$CONFIG_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).name || '')")
            PROVIDER=$(echo "$CONFIG_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).provider || '')")
            API_KEY=$(echo "$CONFIG_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).apiKey || '')")
            BASE_URL=$(echo "$CONFIG_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).baseUrl || '')")
            MODEL=$(echo "$CONFIG_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).model || '')")
            
            echo "📋 当前配置: $NAME"
            echo "   模型: $MODEL"
            echo ""
            
            # 导出环境变量
            if [ -n "$API_KEY" ]; then
                case "$PROVIDER" in
                    anthropic)
                        export ANTHROPIC_API_KEY="$API_KEY"
                        ;;
                    openai)
                        export OPENAI_API_KEY="$API_KEY"
                        ;;
                    gemini)
                        export GEMINI_API_KEY="$API_KEY"
                        ;;
                    grok)
                        export GROK_API_KEY="$API_KEY"
                        ;;
                    custom)
                        # 自定义 API，根据 baseUrl 判断
                        if echo "$BASE_URL" | grep -q "volces\|ark"; then
                            export DOUBAO_API_KEY="$API_KEY"
                        fi
                        ;;
                esac
            fi
            
            if [ -n "$BASE_URL" ]; then
                case "$PROVIDER" in
                    openai)
                        export OPENAI_BASE_URL="$BASE_URL"
                        ;;
                    gemini)
                        export GEMINI_BASE_URL="$BASE_URL"
                        ;;
                    grok)
                        export GROK_BASE_URL="$BASE_URL"
                        ;;
                    custom)
                        export CUSTOM_BASE_URL="$BASE_URL"
                        ;;
                esac
            fi
            
            if [ -n "$MODEL" ]; then
                case "$PROVIDER" in
                    openai)
                        export OPENAI_MODEL="$MODEL"
                        ;;
                    gemini)
                        export GEMINI_MODEL="$MODEL"
                        ;;
                    grok)
                        export GROK_MODEL="$MODEL"
                        ;;
                    custom)
                        export CUSTOM_MODEL="$MODEL"
                        ;;
                esac
                export CLAUDE_MODEL="$MODEL"
            fi
        fi
    else
        echo "⚠️  需要 Node.js 来读取配置"
    fi
}

# 导出环境变量
export_env_from_settings

echo "🚀 启动 Claude Code..."
echo ""

# 启动 Claude Code
bun run dev
