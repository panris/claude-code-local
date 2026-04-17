#!/bin/bash
# Claude Code 启动脚本 - 使用本地 Ollama 模型

# 启用 OpenAI provider
export CLAUDE_CODE_USE_OPENAI=1

# Ollama 配置
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_API_KEY=sk-dummy

# 模型名称 (根据你的模型调整)
export OPENAI_MODEL=qwen3.5:9b
export OPENAI_DEFAULT_SONNET_MODEL=qwen3.5:9b

# 启动 Claude Code
bun run dev
