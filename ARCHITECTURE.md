# Claude Code 模型代理系统 — 完整调用流程图

## 系统架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Claude Code 模型代理系统                              │
│                                                                             │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐              │
│  │ Claude   │    │  proxy.js        │    │  上游 AI API      │              │
│  │ Code CLI │───▶│  (端口 12654)     │───▶│  (Kimi/DeepSeek/ │              │
│  │ (bun)    │◀───│  协议转换代理      │◀───│   OpenAI/Ollama)  │              │
│  └──────────┘    └────────┬─────────┘    └──────────────────┘              │
│                           │ 每次请求读取                                      │
│                           ▼                                                 │
│                    ┌─────────────┐                                          │
│                    │ ~/.claude/   │                                          │
│                    │   .env      │                                          │
│                    └──────▲──────┘                                          │
│                           │ 写入                                             │
│  ┌──────────┐    ┌────────┴─────────┐                                      │
│  │ 浏览器    │───▶│  server-litellm  │                                      │
│  │ (Web UI) │◀───│  .js (端口 3000) │                                      │
│  └──────────┘    └────────┬─────────┘                                      │
│                           │ 写入                                             │
│                    ┌──────┴──────────────┐                                   │
│                    │                     │                                   │
│              ┌─────▼─────┐    ┌─────────▼──────────┐                        │
│              │litellm_   │    │active-model.json    │                        │
│              │config.yaml│    │(激活状态持久化)       │                        │
│              └───────────┘    └────────────────────┘                         │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │  start-full.sh — 一键启动（配置页+代理+Claude Code）           │           │
│  └──────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 持久化文件说明

| 文件 | 路径 | 读方 | 写方 | 用途 |
|------|------|------|------|------|
| `.env` | `~/.claude/.env` | proxy.js (每次请求) | server-litellm.js | 代理运行时配置（key/url/model） |
| `litellm_config.yaml` | `~/.claude/litellm_config.yaml` | server-litellm.js | server-litellm.js | 全部模型配置定义 |
| `active-model.json` | `~/.claude/active-model.json` | server-litellm.js | server-litellm.js | 当前激活的配置名+模型名 |

---

## 流程 1：一键启动 (start-full.sh)

```
用户执行: sh start-full.sh
    │
    ▼
[清理旧进程]
    │ pkill -f "node.*proxy.js"
    │ pkill -f "node.*server-litellm.js"
    │
    ▼
[检查 ~/.claude/.env 是否存在]
    │
    ├─ 不存在 → ❌ 报错退出，提示创建配置文件
    │
    └─ 存在 ↓
        │
        ▼
    [读取 .env 获取当前模型名]
        │ source ~/.claude/.env
        │ MODEL=$OPENAI_MODEL
        │
        ▼
    ┌───────────────────────────────────────┐
    │ 启动配置页面 (后台进程)                  │
    │ node model-config-server/server-      │
    │       litellm.js &                     │
    │ PID_SERVER=$!                          │
    │ → 监听 0.0.0.0:3000                    │
    └───────────────┬───────────────────────┘
                    │ sleep 1
                    ▼
    ┌───────────────────────────────────────┐
    │ 启动代理服务器 (后台进程)                │
    │ node model-config-server/proxy.js &   │
    │ PID_PROXY=$!                           │
    │ → 监听 0.0.0.0:12654                   │
    └───────────────┬───────────────────────┘
                    │ sleep 2
                    ▼
    [健康检查]
    │ curl localhost:12654/health
    │ curl localhost:3000/
    │
    ├─ 代理失败 → cleanup + 退出
    └─ 均成功 ↓
        │
        ▼
    [设置环境变量]
    │ export ANTHROPIC_BASE_URL=http://localhost:12654
    │ export ANTHROPIC_API_KEY=not-needed
    │
        ▼
    ┌───────────────────────────────────────┐
    │ 启动 Claude Code (前台进程)             │
    │ bun run dev                            │
    │ → Claude Code 读取环境变量：             │
    │   ANTHROPIC_BASE_URL → 代理地址         │
    │   ANTHROPIC_API_KEY → 任意值            │
    │ → 所有请求走代理                        │
    └───────────────────────────────────────┘
        │
        ▼ (Ctrl+C)
    [trap cleanup SIGINT]
    │ kill $PID_SERVER
    │ kill $PID_PROXY
    │ 退出
```

---

## 流程 2：Claude Code 发起对话请求（核心流程）

```
Claude Code 用户输入消息
    │
    ▼
Claude Code 构造 Anthropic 格式请求:
    POST http://localhost:12654/v1/messages?beta=true
    ┌─────────────────────────────────────────────────────┐
    │ Headers:                                            │
    │   Content-Type: application/json                    │
    │   x-api-key: not-needed                             │
    │   anthropic-version: 2023-06-01                     │
    │ Body:                                               │
    │ {                                                   │
    │   "model": "claude-sonnet-4-6",   ← 默认模型名       │
    │   "max_tokens": 16384,                              │
    │   "stream": true,                 ← 默认流式          │
    │   "system": "You are...",          ← system prompt   │
    │   "messages": [                                     │
    │     {"role":"user","content":"..."}                  │
    │   ]                                                 │
    │ }                                                   │
    └─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  proxy.js — HTTP 服务器 (端口 12654)                                     │
│                                                                         │
│  ① 路由匹配                                                             │
│     req.url.split('?')[0] → 去除 query string                           │
│     "/v1/messages?beta=true" → "/v1/messages"                           │
│     匹配 → handleMessages(req, res, body)                               │
│                                                                         │
│  ② 读取配置                                                             │
│     getConfig() → 每次请求实时读取 ~/.claude/.env                         │
│     ┌─────────────────────────────────────────┐                         │
│     │ 返回: {                                   │                         │
│     │   OPENAI_API_KEY: "sk-xxx",              │                         │
│     │   OPENAI_BASE_URL: "https://api.moonshot.cn/v1",                  │
│     │   OPENAI_MODEL: "kimi-k2.6"             │                         │
│     │ }                                         │                         │
│     └─────────────────────────────────────────┘                         │
│     │                                                                   │
│     ├─ 配置为空 → 500 "未配置模型"                                       │
│     └─ 配置有效 ↓                                                       │
│                                                                         │
│  ③ 解析请求体 JSON                                                      │
│     ├─ 解析失败 → 400 "无效的 JSON"                                     │
│     └─ 解析成功 ↓                                                       │
│                                                                         │
│  ④ 模型名映射                                                           │
│     mapModel("claude-sonnet-4-6", "kimi-k2.6")                          │
│     ├─ "claude-sonnet-4-6".startsWith("claude-") → true                 │
│     └─ 返回 configModel → "kimi-k2.6"  ✅ 替换成功                      │
│     ※ 非 claude- 开头的模型名则原样传递                                   │
│                                                                         │
│  ⑤ 提取参数                                                             │
│     model        = "kimi-k2.6"                                         │
│     maxTokens    = 16384                                                │
│     temperature  = parsed.temperature (如有)                             │
│     topP         = parsed.top_p (如有)                                  │
│     stream       = true                                                 │
│     systemPrompt = "You are..."                                         │
│     messages     = [{role:"user", content:"..."}]                        │
│     baseUrl      = "https://api.moonshot.cn/v1"                         │
│     apiKey       = "sk-xxx"                                             │
│                                                                         │
│  ⑥ 判断后端类型                                                         │
│     isOllamaUrl(baseUrl)?                                               │
│     ├─ 是 → Ollama 路径 (见流程 3)                                      │
│     └─ 否 → OpenAI 兼容路径 ↓                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 流程 2a：OpenAI 兼容后端 — 非流式请求

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⑦ 构造 OpenAI 格式请求体                                               │
│                                                                         │
│     openaiMessages = []                                                 │
│                                                                         │
│     ┌─ systemPrompt 非空?                                               │
│     │   是 → openaiMessages.push({role:"system", content: systemPrompt})│
│     │        ↑ 关键转换：Anthropic 的 system 字段 → OpenAI 的 system role│
│     └─ 否 → 跳过                                                        │
│                                                                         │
│     ┌─ 遍历 messages                                                    │
│     │   Anthropic content 可能是数组:                                    │
│     │     [{type:"text",text:"..."}, {type:"image",...}]                │
│     │   → 过滤 type==="text"，join 为字符串                              │
│     │   push({role: msg.role, content: 提取后的文本})                    │
│     └─                                                                  │
│                                                                         │
│     requestBody = {                                                     │
│       model: "kimi-k2.6",                                              │
│       messages: openaiMessages,                                         │
│       max_tokens: 16384,                                                │
│       stream: false                                                     │
│     }                                                                   │
│     // 可选参数透传                                                      │
│     if (temperature !== undefined) requestBody.temperature = temperature│
│     if (topP !== undefined) requestBody.top_p = topP                    │
│                                                                         │
│  ⑧ 发送到上游 API                                                       │
│     URL: https://api.moonshot.cn/v1/chat/completions                    │
│     Method: POST                                                        │
│     Headers:                                                            │
│       Content-Type: application/json                                    │
│       Authorization: Bearer sk-xxx                                      │
│     Timeout: 120000ms (2分钟)                                           │
│     Body: requestBody                                                   │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  上游 API 返回 OpenAI 格式响应                                           │
│                                                                         │
│  {                                                                      │
│    "id": "chatcmpl-xxx",                                                │
│    "choices": [{                                                        │
│      "message": {                                                       │
│        "role": "assistant",                                             │
│        "content": "Hello! How can I...",     ← 主要回复内容              │
│        "reasoning_content": "Let me..."      ← 推理模型特有(可选)        │
│      },                                                                 │
│      "finish_reason": "stop"                                            │
│    }],                                                                  │
│    "usage": { "prompt_tokens":100, "completion_tokens":50 }             │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ⑨ 转换为 Anthropic 格式响应                                            │
│                                                                         │
│  处理逻辑:                                                              │
│  ┌─ json.error 存在?                                                    │
│  │   是 → 返回上游错误码 + {error:{type:"api_error",message:...}}      │
│  └─ 否 ↓                                                               │
│                                                                         │
│  提取:                                                                  │
│    choice  = json.choices[0]                                            │
│    message = choice.message                                             │
│    content = message.content                                            │
│    reasoning = message.reasoning_content (推理模型)                      │
│                                                                         │
│  ┌─ reasoning_content 存在?                                             │
│  │   是 → response.content = [{type:"text", text: content}]             │
│  │        (优先使用 content，reasoning 作为辅助)                         │
│  └─ 否 → response.content = [{type:"text", text: content}]             │
│                                                                         │
│  最终响应:                                                              │
│  {                                                                      │
│    "id": "msg-1713950000000",                                           │
│    "type": "message",                                                   │
│    "role": "assistant",                                                 │
│    "content": [{"type":"text","text":"Hello! How can I..."}],           │
│    "model": "kimi-k2.6",                                               │
│    "stop_reason": "end_turn",    ← "stop" → "end_turn" 映射            │
│    "stop_sequence": null,                                               │
│    "usage": {"prompt_tokens":100,"completion_tokens":50}                │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Claude Code 接收 Anthropic 格式响应 → 渲染到终端
```

---

## 流程 2b：OpenAI 兼容后端 — 流式请求 (stream: true)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⑦ 构造请求 (同非流式，stream: true)                                     │
│                                                                         │
│  ⑧ 发送到上游，接收 SSE 流                                              │
│     上游返回格式:                                                        │
│     data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
│     data: {"choices":[{"delta":{"content":"!"},"finish_reason":null}]}  │
│     ...                                                                 │
│     data: {"choices":[{"delta":{},"finish_reason":"stop"}]}             │
│     data: [DONE]                                                        │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ⑨ 流式协议转换 (OpenAI SSE → Anthropic SSE)                            │
│                                                                         │
│  先检查上游状态码:                                                       │
│  ├─ ≥ 400 → 收集错误信息，返回 Anthropic 错误 JSON                       │
│  └─ 200 → 设置响应头:                                                   │
│      Content-Type: text/event-stream                                    │
│      Cache-Control: no-cache                                            │
│      Connection: keep-alive                                             │
│                                                                         │
│  逐行解析 SSE data:                                                     │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │  OpenAI SSE              →    Anthropic SSE               │          │
│  │  ─────────────────────────────────────────────────────    │          │
│  │  delta.content = "Hello"                                │          │
│  │    → event: content_block_delta                         │          │
│  │      data: {"type":"content_block_delta",               │          │
│  │            "index":0,                                    │          │
│  │            "delta":{"type":"text_delta","text":"Hello"}} │          │
│  │                                                          │          │
│  │  finish_reason = "stop"                                 │          │
│  │    → event: message_delta                               │          │
│  │      data: {"type":"message_delta",                     │          │
│  │            "delta":{"stop_reason":"end_turn"},          │          │
│  │            "usage":{"output_tokens":N}}                  │          │
│  │                                                          │          │
│  │  [DONE]                                                 │          │
│  │    → event: message_stop                                │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  缓冲机制:                                                              │
│    buffer += chunk → 按 \n 分割 → 处理完整行 → 保留未完成行               │
│    (确保不完整 SSE 行不会导致 JSON 解析错误)                               │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
Claude Code 接收 Anthropic SSE 流 → 逐字渲染到终端
```

---

## 流程 3：Ollama 后端请求

```
┌─────────────────────────────────────────────────────────────────────────┐
│  isOllamaUrl(baseUrl) == true                                           │
│  (baseUrl 包含 localhost:11434 或 127.0.0.1:11434)                      │
│                                                                         │
│  ⑦ 构造 Ollama 格式消息                                                 │
│     anthropicToOllama(messages, systemPrompt)                           │
│     ┌─ systemPrompt 非空 → push({role:"system", content: systemPrompt}) │
│     └─ 遍历 messages → push({role, content})                            │
│        (user→user, assistant→assistant)                                  │
│                                                                         │
│  ⑧ 发送到 Ollama                                                       │
│     POST http://localhost:11434/api/chat                                │
│     Body: {model:"qwen2.5", messages:ollamaMessages, stream:false}      │
│     ※ Ollama 路径始终非流式                                              │
│                                                                         │
│  ⑨ 转换 Ollama 响应                                                     │
│     Ollama 返回: {message:{content:"回复内容"}}                          │
│     → 转为 Anthropic 格式 (同流程 2a 的 ⑨)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 流程 4：Web UI 激活模型

```
用户在浏览器点击"激活"按钮
    │
    ▼
前端 activateConfig(name)
    │
    ▼
POST /api/configs/{name}/activate
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server-litellm.js 处理激活请求                                         │
│                                                                         │
│  ① 从 litellm_config.yaml 读取配置                                     │
│     readConfig() → 找到 model_name == name 的条目                       │
│     │                                                                   │
│     ├─ 找不到 → 仍返回 success（兼容）                                   │
│     └─ 找到 ↓                                                          │
│         params = modelEntry.litellm_params                              │
│         model  = modelEntry.model_name   (如 "kimi-k2.6")              │
│         apiKey = params.api_key          (如 "sk-xxx")                  │
│         baseUrl = params.api_base        (如 "https://api.moonshot.cn/v1")
│                                                                         │
│  ② 同步写入 .env                                                        │
│     syncEnvFile(name, model, apiKey, baseUrl)                           │
│     → 写入 ~/.claude/.env:                                              │
│       ┌─────────────────────────────────────┐                          │
│       │ # Claude Code 环境变量配置            │                          │
│       │ # 当前激活配置: kimi-k2.6            │                          │
│       │ CUSTOM_API_KEY=sk-xxx               │                          │
│       │ CUSTOM_BASE_URL=https://api.moonshot.cn/v1                       │
│       │ OPENAI_API_KEY=sk-xxx              │                          │
│       │ OPENAI_BASE_URL=https://api.moonshot.cn/v1                       │
│       │ OPENAI_MODEL=kimi-k2.6             │                          │
│       │ CLAUDE_CODE_USE_OPENAI=1            │                          │
│       │ CLAUDE_MODEL=kimi-k2.6             │                          │
│       └─────────────────────────────────────┘                          │
│                                                                         │
│  ③ 持久化激活状态                                                       │
│     writeActive(name, model)                                            │
│     → 写入 ~/.claude/active-model.json:                                 │
│       {"activeConfig":"kimi-k2.6","model":"kimi-k2.6","updatedAt":"..."}
│                                                                         │
│  ④ 返回 JSON                                                           │
│     {success:true, activeConfig:"kimi-k2.6", activeModel:"kimi-k2.6"}  │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
前端收到响应
    │ activeConfig = name
    │ currentModel = data.activeModel
    │ renderConfigList() → 重新渲染 UI
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  UI 渲染变化                                                            │
│                                                                         │
│  配置组卡片:                                                            │
│  ┌─────────────────────────────────────────────┐                       │
│  │ kimi-k2.6                    ✓ 当前激活      │  ← 绿色边框+徽章      │
│  │ Kimi → https://api.moonshot.cn/v1            │                       │
│  │─────────────────────────────────────────────│                       │
│  │ 可用模型 (1)                                  │                       │
│  │ [kimi-k2.6 ✓]              ← 绿色标记        │                       │
│  │                              当前使用中        │                       │
│  └─────────────────────────────────────────────┘                       │
│                                                                         │
│  其他配置组: 无"✓ 当前激活"徽章，有"激活"按钮                             │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼ (下次 Claude Code 请求时)
proxy.js getConfig() 读取更新后的 .env → 新模型配置生效
※ 无需重启任何服务
```

---

## 流程 5：Web UI 切换模型

```
用户在浏览器点击模型标签 (在已激活的配置组内)
    │
    ▼
前端 switchModel(configName, model)
    │
    ▼
POST /api/configs/{configName}/switch-model
    Body: {"model": "moonshot-v1-8k"}
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server-litellm.js 处理切换请求                                         │
│                                                                         │
│  ① 查找目标模型配置                                                     │
│     先在 model_list 中找 model_name == "moonshot-v1-8k"                 │
│     ├─ 找到 → 用该条目的 apiKey / baseUrl                               │
│     └─ 找不到 → 用 configName 条目的 apiKey / baseUrl（只换模型名）      │
│                                                                         │
│  ② syncEnvFile(configName, "moonshot-v1-8k", apiKey, baseUrl)          │
│     → .env 中 OPENAI_MODEL 变为 "moonshot-v1-8k"                       │
│                                                                         │
│  ③ writeActive(configName, "moonshot-v1-8k")                           │
│     → active-model.json 更新                                            │
│                                                                         │
│  ④ 返回 {success:true, activeConfig, model:"moonshot-v1-8k"}           │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
前端更新 local 状态 + 重新渲染
    │
    ▼ (下次 Claude Code 请求时)
proxy.js 用新模型名请求上游
```

---

## 流程 6：Web UI 新增配置组

```
用户填写表单 → 点击"保存"
    │
    ▼
前端 saveConfig()
    │ 编辑模式: 先 DELETE 旧配置
    │ POST /api/configs
    │ Body: {name, provider, apiKey, baseUrl, models}
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server-litellm.js 处理新增                                             │
│                                                                         │
│  ① 参数校验                                                            │
│     ├─ 缺少 name/provider/apiKey → 400                                 │
│     └─ model_name 已存在 → 409                                         │
│                                                                         │
│  ② 获取提供商模板                                                      │
│     PROVIDER_TEMPLATES[provider] → 默认 baseUrl 和 models               │
│     finalBaseUrl = 用户填的 || 模板的                                    │
│     modelNames = 用户填的 || 模板的                                      │
│                                                                         │
│  ③ 写入 litellm_config.yaml                                            │
│     每个 model 创建一条:                                                │
│     {model_name: "deepseek-chat",                                       │
│      litellm_params: {model:"openai/deepseek-chat",                     │
│                       api_base:"https://api.deepseek.com/v1",           │
│                       api_key:"sk-xxx"}}                                │
│                                                                         │
│  ④ 尝试重载 LiteLLM                                                    │
│     POST http://127.0.0.1:12654/model/reload                           │
│     ├─ 成功 → 返回 201 {success, models}                               │
│     └─ 失败 → 返回 201 {success, warning:"请手动重启"}                  │
│         (当前未使用 LiteLLM 代理，reload 不影响)                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 流程 7：页面加载/刷新

```
浏览器打开 http://localhost:3000
    │
    ▼
init() → loadConfigs()
    │
    ▼
GET /api/configs
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server-litellm.js                                                     │
│                                                                         │
│  ① readConfig() → 读取 litellm_config.yaml                             │
│     → 映射每个 model_list 条目:                                         │
│       {name, provider, providerName, apiKey, baseUrl, models, activeModel}
│                                                                         │
│  ② readActive() → 读取 active-model.json                               │
│     → {activeConfig: "kimi-k2.6", model: "kimi-k2.6"}                  │
│                                                                         │
│  ③ 返回 {configs: [...], activeConfig, activeModel}                     │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
前端渲染:
    │ configs → 遍历生成配置组卡片
    │ activeConfig → 标记哪个卡片有绿色边框和"✓ 当前激活"徽章
    │ activeModel → 标记哪个模型标签有绿色 "✓"
    │
    ▼
并行请求:
    │ GET /api/health → 更新状态栏（服务器连接状态）
    │ GET /api/settings → 更新 JSON 预览标签页
```

---

## 流程 8：错误处理路径

```
┌─────────────────────────────────────────────────────────────────────────┐
│  proxy.js 错误处理                                                      │
│                                                                         │
│  上游连接失败 (DNS/网络)                                                │
│    fwdReq.on('error') → 502 {error:{type:"api_error",                  │
│      message:"上游连接失败: ECONNREFUSED"}}                             │
│                                                                         │
│  上游超时 (120s)                                                        │
│    fwdReq.on('timeout') → fwdReq.destroy() → 504                       │
│      {error:{type:"api_error",message:"上游请求超时"}}                   │
│                                                                         │
│  上游返回 4xx/5xx                                                       │
│    → 解析 json.error → 返回对应状态码 + Anthropic 错误格式              │
│                                                                         │
│  上游返回 429 (Too Many Requests)                                       │
│    → 同上，透传错误信息                                                  │
│                                                                         │
│  响应 JSON 解析失败                                                     │
│    → 502 {error:{type:"api_error",message:"上游响应解析失败",raw:"..."}} │
│                                                                         │
│  重复响应防护                                                            │
│    let responded = false;                                               │
│    timeout 和 error 事件都检查 responded 标志位                          │
│    避免ERR_HTTP_HEADERS_SENT 崩溃                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 流程 9：协议转换对照表

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Anthropic ↔ OpenAI 协议转换                           │
│                                                                         │
│  ┌─────────────────────────┬──────────────────────────────┐            │
│  │ Anthropic (输入)         │ OpenAI (转发)                 │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ POST /v1/messages       │ POST {baseUrl}/chat/          │            │
│  │                         │      completions              │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ system: "prompt"        │ messages[0]:                  │            │
│  │ (顶层字段)               │   {role:"system",             │            │
│  │                         │    content:"prompt"}          │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ model: "claude-sonnet-  │ model: "kimi-k2.6"           │            │
│  │         4-6"            │ (经过 mapModel 映射)          │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ max_tokens: 16384       │ max_tokens: 16384             │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ temperature: 0.7        │ temperature: 0.7              │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ top_p: 0.9              │ top_p: 0.9                    │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ stream: true            │ stream: true                  │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ messages[].content      │ messages[].content            │            │
│  │ (可能是数组)             │ (始终为字符串)                 │            │
│  │ [{type:"text",          │ "hello"                       │            │
│  │   text:"hello"}]        │                               │            │
│  └─────────────────────────┴──────────────────────────────┘            │
│                                                                         │
│  ┌─────────────────────────┬──────────────────────────────┐            │
│  │ OpenAI (上游响应)        │ Anthropic (返回给 Claude Code)│            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ choices[0].message.     │ content:                      │            │
│  │   content               │   [{type:"text",text:"..."}] │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ finish_reason:"stop"    │ stop_reason:"end_turn"        │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ usage.completion_tokens │ usage.output_tokens           │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ 流式: delta.content     │ 流式: text_delta              │            │
│  │       finish_reason     │       stop_reason             │            │
│  │       [DONE]            │       message_stop            │            │
│  └─────────────────────────┴──────────────────────────────┘            │
│                                                                         │
│  ┌─────────────────────────┬──────────────────────────────┐            │
│  │ 推理模型特殊处理         │                              │            │
│  ├─────────────────────────┼──────────────────────────────┤            │
│  │ message.reasoning_      │ 如有 reasoning + content:     │            │
│  │   content               │   优先用 content 作为回复     │            │
│  │ (Kimi k2.6 特有)        │ 如只有 reasoning:             │            │
│  │                         │   用 reasoning 作为回复       │            │
│  └─────────────────────────┴──────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 流程 10：proxy.js 完整路由表

```
┌──────────────┬────────┬─────────────────────────────────────────────────┐
│ 路径          │ 方法   │ 处理逻辑                                        │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ /v1/messages │ GET    │ 返回端点可用信息                                 │
│              │        │ {type:"messages_endpoint",status:"available"}   │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ /v1/messages │ POST   │ 核心路由：Anthropic → OpenAI 转换               │
│ /v1/messages?│        │ ① 读 .env ② 解析 ③ mapModel                    │
│   beta=true  │        │ ④ 构造 OpenAI 请求 ⑤ 转发                      │
│              │        │ ⑥ 转换响应（流式/非流式）                        │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ /v1/chat/    │ POST   │ OpenAI 透传：替换 model 名后直接转发             │
│ completions  │        │ 响应原样返回                                    │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ /v1/models   │ GET    │ 返回当前配置的模型信息                           │
│              │        │ {data:[{id:"kimi-k2.6",owned_by:"local"}]}      │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ /health      │ GET    │ 健康检查                                        │
│              │        │ {status:"ok",port:12654,model:"kimi-k2.6"}      │
├──────────────┼────────┼─────────────────────────────────────────────────┤
│ 其他          │ 任意   │ 404 + 支持的路由列表                            │
└──────────────┴────────┴─────────────────────────────────────────────────┘

CORS 头: 所有响应都设置 Access-Control-Allow-Origin: *
OPTIONS: 返回 200 (预检请求)
```

---

## 流程 11：server-litellm.js 完整 API 路由表

```
┌──────────────────────────┬────────┬──────────────────────────────────────┐
│ 路径                      │ 方法   │ 处理逻辑                             │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /                        │ GET    │ 返回 index.html 前端页面             │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs             │ GET    │ 列出所有配置 + 激活状态              │
│                          │        │ 读取 yaml + active-model.json       │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs             │ POST   │ 新增配置组                           │
│                          │        │ 写入 yaml + reload LiteLLM          │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs/:name       │ GET    │ 获取单个配置详情                     │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs/:name       │ PUT    │ 更新配置（apiKey/baseUrl）           │
│                          │        │ 写入 yaml + reload LiteLLM          │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs/:name       │ DELETE │ 删除配置                             │
│                          │        │ 写入 yaml + reload LiteLLM          │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs/:name/      │ POST   │ 激活配置组 ★                        │
│   activate               │        │ syncEnvFile + writeActive           │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/configs/:name/      │ POST   │ 切换模型 ★                          │
│   switch-model           │        │ syncEnvFile + writeActive           │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/active              │ GET    │ 查询当前激活状态                     │
│                          │        │ 读取 active-model.json + .env       │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/settings            │ GET    │ 返回完整 yaml 配置 (JSON预览用)      │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/providers           │ GET    │ 返回提供商模板列表                   │
├──────────────────────────┼────────┼──────────────────────────────────────┤
│ /api/health              │ GET    │ 健康检查 + LiteLLM 连通性            │
└──────────────────────────┴────────┴──────────────────────────────────────┘

★ = 激活/切换操作会同时写入:
   1. ~/.claude/.env           → proxy.js 运行时配置
   2. ~/.claude/active-model.json → 激活状态持久化
```
