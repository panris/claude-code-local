# Claude Code 配置文件说明

## 文件位置
```
~/.claude/settings.json
```

## 当前完整配置

```json
{
  "model": "gemma4:latest",
  "modelType": "openai",
  "enabledPlugins": {
    "claude-mem@thedotmack": true
  },
  "extraKnownMarketplaces": {
    "thedotmack": {
      "source": {
        "source": "github",
        "repo": "thedotmack/claude-mem"
      }
    }
  },
  "effortLevel": "high",
  "modelConfigs": [
    {
      "name": "本地 Gemma4",
      "provider": "openai",
      "apiKey": "sk-dummy",
      "baseUrl": "http://localhost:11434/v1",
      "model": "gemma4:latest"
    }
  ],
  "activeModelConfig": "本地 Gemma4"
}
```

---

## 配置项详解

### 基础模型配置

| 字段 | 当前值 | 说明 |
|------|--------|------|
| `model` | `gemma4:latest` | 当前使用的模型ID |
| `modelType` | `openai` | API提供商类型 (anthropic/openai/gemini/grok) |
| `activeModelConfig` | `本地 Gemma4` | 当前激活的配置名称 |

### 模型配置列表 (modelConfigs)

当前只有一个配置：

```json
{
  "name": "本地 Gemma4",           // 配置显示名称
  "provider": "openai",            // 使用 OpenAI 兼容接口
  "apiKey": "sk-dummy",            // Ollama 不需要真实 key
  "baseUrl": "http://localhost:11434/v1",  // Ollama 本地地址
  "model": "gemma4:latest"         // 模型名称
}
```

### 插件配置

| 字段 | 说明 |
|------|------|
| `enabledPlugins` | 已启用的插件列表 |
| `claude-mem@thedotmack` | 记忆插件，让 Claude 记住跨会话信息 |
| `extraKnownMarketplaces` | 额外的插件市场源 |

### 其他设置

| 字段 | 当前值 | 说明 |
|------|--------|------|
| `effortLevel` | `high` | 模型努力程度 (low/medium/high/max) |

---

## 如何添加更多本地模型

### 方式 1: 通过 Web 界面 (推荐)

1. 访问 http://localhost:3000
2. 点击 "新增配置"
3. 填写:
   - **配置名称**: 本地 Llama3
   - **API 提供商**: OpenAI
   - **API Key**: sk-dummy
   - **API 地址**: http://localhost:11434/v1
   - **模型**: llama3:latest
4. 点击保存

### 方式 2: 直接编辑配置文件

在 `modelConfigs` 数组中添加：

```json
{
  "name": "本地 Llama3",
  "provider": "openai",
  "apiKey": "sk-dummy",
  "baseUrl": "http://localhost:11434/v1",
  "model": "llama3:latest"
}
```

---

## 常用 Ollama 模型参考

| 模型 | 配置值 | 特点 |
|------|--------|------|
| Gemma 4 | `gemma4:latest` | Google 开源，当前使用 |
| Llama 3 | `llama3:latest` | Meta 开源 |
| Qwen 2.5 | `qwen2.5:latest` | 阿里开源，中文好 |
| Mistral | `mistral:latest` | 欧洲开源 |
| Phi-4 | `phi4:latest` | 微软开源 |

---

## 启动方式

### 1. 仅启动 Claude Code (使用当前配置)
```bash
./start-local.sh
```

### 2. 启动 Claude Code + Web 配置界面
```bash
./start-with-config.sh
```
然后访问 http://localhost:3000 管理配置

### 3. 仅启动 Web 配置界面
```bash
./start-model-config.sh
```
