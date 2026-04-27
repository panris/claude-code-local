# Claude Code 本地化功能说明

## 项目概述

claude-code-local 是 Claude Code CLI 的本地逆向项目，核心功能是让 Claude Code 能够使用本地部署的模型服务（如 Ollama、Moonshot、DeepSeek 等）。

---

## 核心功能

### 1. 模型配置管理页面 (Web UI)

**端口**: 3000

功能：
- 可视化配置多个模型提供商
- 支持添加/编辑/删除模型配置
- 支持模型组管理（一个 API Key 配置多个模型）
- 实时切换当前使用的模型
- 配置持久化到 `~/.claude/settings.json`

支持的提供商：
- OpenAI 兼容接口（Ollama、LM Studio、Moonshot、DeepSeek 等）
- Anthropic API
- Google Gemini
- Groq

访问地址：`http://localhost:3000`

### 2. 动态代理服务 (Proxy)

**端口**: 12655（避免与 Evol 软件冲突）

功能：
- 将 Claude Code 的 API 请求转发到配置的模型服务端点
- 支持 Anthropic 格式 `/v1/messages`
- 支持 OpenAI 格式 `/v1/chat/completions`
- 自动模型名称映射
- SSE 流式响应支持
- 热重载配置（`POST /reload`）
- 健康检查（`GET /health`）

### 3. 一键启动脚本

提供三个启动脚本：

| 脚本 | 功能 |
|------|------|
| `start.sh` | 启动完整服务（配置页面 + 代理） |
| `start-local.sh` | 仅启动 Claude Code（使用本地配置） |
| `start-with-config.sh` | 启动 Claude Code + Web 配置界面 |

---

## 配置文件

### 位置
```
~/.claude/settings.json
~/.claude/.env
```

### settings.json 结构

```json
{
  "model": "gemma4:latest",
  "modelType": "openai",
  "modelConfigs": [
    {
      "name": "配置名称",
      "provider": "openai|anthropic|gemini|groq",
      "apiKey": "xxx",
      "baseUrl": "http://localhost:11434/v1",
      "model": "model-name"
    }
  ],
  "activeModelConfig": "配置名称"
}
```

---

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| 配置页面 | 3000 | Web 管理界面 |
| 代理服务 | 12655 | API 转发服务 |

> **注意**: 12655 是为了避免与 Evol 软件冲突而选用的端口（原为 12654）

---

## 使用流程

### 1. 启动服务
```bash
./start.sh
```

### 2. 访问配置页面
打开浏览器访问 http://localhost:3000

### 3. 添加模型配置
- 点击"新增配置"
- 选择提供商类型
- 填写 API Key、Endpoint、模型名称
- 保存

### 4. 开始使用
```bash
claude
```

---

## 常见问题

### Q: 12654 端口被占用？
A: 请确保 Evol 软件未运行，或已使用 12655 端口版本

### Q: 模型无法连接？
A: 检查 API Key 是否正确，baseUrl 是否可达

### Q: 如何切换模型？
A: 访问 http://localhost:3000 点击模型卡片切换

---

## 技术架构

```
┌─────────────────┐
│  Claude Code    │  (claude)
└────────┬────────┘
         │ API 请求
         ▼
┌─────────────────┐
│  proxy.js      │  :12655
│  (代理服务)    │
└────────┬────────┘
         │ 转发
         ▼
┌─────────────────┐
│  Ollama/Moonshot│  :11434/v1
│  (模型服务)   │
└─────────────────┘

┌─────────────────┐
│  Web 浏览器    │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
��� server-litellm │ :3000
│ (配置管理页面) │
└────────┬────────┘
         │ 读写
         ▼
┌─────────────────┐
│ settings.json  │
│ (.claude 目录) │
└─────────────────┘
```