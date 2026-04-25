'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const PROXY_PORT = 12654;
const PROXY_HOST = '127.0.0.1';

// ── 提供商模板 ──────────────────────────────────────────────────────
const PROVIDER_TEMPLATES = {
  kimi:      { name: 'Kimi',          baseUrl: 'https://api.moonshot.cn/v1',                        models: ['kimi-k2.6', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  deepseek:   { name: 'DeepSeek',       baseUrl: 'https://api.deepseek.com',                        models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
  qwen:      { name: '通义千问',        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  zhipu:     { name: '智谱 GLM',        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',            models: ['glm-4-plus', 'glm-4-air'] },
  ark:       { name: '火山引擎 ARK',     baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',       models: [] },
  openai:    { name: 'OpenAI',          baseUrl: 'https://api.openai.com/v1',                      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  anthropic: { name: 'Anthropic',       baseUrl: 'https://api.anthropic.com/v1',                   models: ['claude-sonnet-4-20250514', 'claude-opus-4-6'] },
  ollama:    { name: 'Ollama (本地)',    baseUrl: 'http://localhost:11434',                        models: ['llama3', 'qwen2.5', 'gemma2'] },
  groq:      { name: 'Groq (免费)',      baseUrl: 'https://api.groq.com/openai/v1',                models: ['llama-3.1-8b-instant', 'llama-3.2-1b-preview', 'llama-3.2-3b-preview', 'mixtral-8x7b-32768'] },
  custom:    { name: '自定义 API',       baseUrl: '',                                              models: [] }
};

// ── 文件路径 ────────────────────────────────────────────────────────
function getGroupsPath() { return path.join(os.homedir(), '.claude', 'config-groups.json'); }
function getConfigPath() { return path.join(os.homedir(), '.claude', 'litellm_config.yaml'); }
function getActivePath() { return path.join(os.homedir(), '.claude', 'active-model.json'); }
function getEnvPath()    { return path.join(os.homedir(), '.claude', '.env'); }

// ── JSON 配置读写 ───────────────────────────────────────────────────
function readGroups() {
  const p = getGroupsPath();
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function writeGroups(groups) {
  const p = getGroupsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(groups, null, 2), 'utf8');
}

function readActive() {
  const p = getActivePath();
  if (!fs.existsSync(p)) return { activeGroupId: null, activeModel: null };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { activeGroupId: null, activeModel: null }; }
}

function writeActive(data) {
  const p = getActivePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ── 提供商检测 ──────────────────────────────────────────────────────
function detectProvider(baseUrl) {
  if (!baseUrl) return 'custom';
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) return 'kimi';
  if (baseUrl.includes('deepseek')) return 'deepseek';
  if (baseUrl.includes('dashscope') || baseUrl.includes('aliyun')) return 'qwen';
  if (baseUrl.includes('bigmodel') || baseUrl.includes('zhipu')) return 'zhipu';
  if (baseUrl.includes('openai.com')) return 'openai';
  if (baseUrl.includes('anthropic.com')) return 'anthropic';
  if (baseUrl.includes('volces.com')) return 'ark';
  if (baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')) return 'ollama';
  if (baseUrl.includes('groq.com')) return 'groq';
  return 'custom';
}

// ── YAML 同步（供 LiteLLM/proxy 使用）──────────────────────────────
function syncYaml() {
  const groups = readGroups();
  const lines = [
    '# LiteLLM 配置文件',
    '# 由 Claude Code 模型管理器自动生成',
    '',
    'model_list:'
  ];
  groups.forEach(g => {
    g.models.forEach(modelName => {
      lines.push(`  - model_name: ${modelName}`);
      lines.push('    litellm_params:');
      lines.push(`      model: openai/${modelName}`);
      lines.push(`      api_base: ${g.baseUrl}`);
      lines.push(`      api_key: "${g.apiKey}"`);
    });
  });
  lines.push('', 'general_settings:');
  lines.push('  master_key: sk-claude-local');
  lines.push('', 'litellm_settings:');
  lines.push('  drop_params: true');
  lines.push('  disable_auth: true');

  const yamlPath = getConfigPath();
  const dir = path.dirname(yamlPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(yamlPath, lines.join('\n'), 'utf8');
}

// ── .env 同步（供 proxy.js 使用）───────────────────────────────
function syncEnvFile(group) {
  const model = group.activeModel || (group.models.length > 0 ? group.models[0] : '');
  const baseUrl = group.baseUrl || '';

  // 自动补全 baseUrl（去掉末尾多余的 /chat/completions）
  let cleanBaseUrl = baseUrl;
  if (baseUrl.endsWith('/chat/completions')) {
    cleanBaseUrl = baseUrl.replace(/\/chat\/completions\/?$/, '');
  }

  const lines = [
    '# Claude Code 环境变量配置',
    '# 由模型配置管理器自动生成 ' + new Date().toISOString(),
    '',
    'CLAUDE_MODEL=' + model,
    'OPENAI_API_KEY=' + (group.apiKey || ''),
    'OPENAI_BASE_URL=' + cleanBaseUrl,
    'OPENAI_BASE_URL_FULL=' + baseUrl,
    '',
    '# LiteLLM master key（本地代理认证）',
    'LITELLM_MASTER_KEY=sk-claude-local'
  ];

  const envPath = getEnvPath();
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// ── 通知 proxy 重载配置 ───────────────────────────────────────────
function notifyProxy() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: PROXY_HOST, port: PROXY_PORT, path: '/reload', method: 'POST' },
      () => resolve()
    );
    req.on('error', () => resolve());
    req.end();
    setTimeout(resolve, 500);
  });
}

// ── 迁移旧 YAML → JSON（一次性）───────────────────────────────
function migrateFromYaml() {
  const yamlPath = getConfigPath();
  if (!fs.existsSync(yamlPath)) return;
  const existing = readGroups();
  if (existing.length > 0) return; // 已有 JSON 不迁移

  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    const lines = content.split('\n');
    const modelList = [];
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('- model_name:')) {
        const modelName = trimmed.replace('- model_name:', '').trim();
        const m = { model_name: modelName, litellm_params: {} };
        i++;
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('- model_name:')) {
          const kv = lines[i].trim();
          if (kv.startsWith('litellm_params:')) { i++; }
          else if (kv.match(/^\w+:/)) {
            const idx = kv.indexOf(':');
            const k = kv.substring(0, idx).trim();
            const v = kv.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            m.litellm_params[k] = v;
          } else if (kv !== '') { i++; }
          else break;
          i++;
        }
        modelList.push(m);
      } else { i++; }
    }

    if (modelList.length === 0) return;

    const groups = modelList.map(m => {
      const baseUrl = m.litellm_params.api_base || '';
      return {
        id: m.model_name + '-' + Date.now(),
        name: m.model_name,
        provider: detectProvider(baseUrl),
        apiKey: m.litellm_params.api_key || '',
        baseUrl,
        models: [m.model_name],
        activeModel: m.model_name
      };
    });

    writeGroups(groups);
  } catch (e) { /* 迁移失败静默跳过 */ }
}

// 启动时迁移旧数据
migrateFromYaml();

// ── 中间件 ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API 路由 ──────────────────────────────────────────────────────

// GET /api/status — 供部署脚本检测是否已配置
app.get('/api/status', (req, res) => {
  const groups = readGroups();
  const active = readActive();
  res.json({
    configured: groups.length > 0,
    activeGroupId: active.activeGroupId,
    activeModel: active.activeModel
  });
});

// GET /api/configs — 返回所有配置组
app.get('/api/configs', (req, res) => {
  const groups = readGroups();
  const active = readActive();
  res.json({ configs: groups, activeGroupId: active.activeGroupId, activeModel: active.activeModel });
});

// POST /api/configs — 新建配置组
app.post('/api/configs', async (req, res) => {
  const { name, provider, apiKey, baseUrl, models } = req.body;
  if (!name || !provider) return res.status(400).json({ error: '缺少配置组名称或提供商' });
  if (!apiKey) return res.status(400).json({ error: '请填写 API Key' });

  const groups = readGroups();
  if (groups.some(g => g.name === name)) {
    return res.status(409).json({ error: '配置组名称已存在，请换一个名称' });
  }

  const template = PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom;
  const finalBaseUrl = baseUrl || template.baseUrl;

  let modelList = [];
  if (typeof models === 'string' && models.trim()) {
    modelList = models.split(',').map(m => m.trim()).filter(Boolean);
  } else if (Array.isArray(models) && models.length > 0) {
    modelList = models;
  } else {
    return res.status(400).json({ error: '请至少填写一个模型名称' });
  }

  const newGroup = {
    id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
    name, provider,
    apiKey,
    baseUrl: finalBaseUrl,
    models: modelList,
    activeModel: modelList[0]
  };

  groups.push(newGroup);
  writeGroups(groups);
  syncYaml();
  syncEnvFile(newGroup);
  await notifyProxy();

  res.status(201).json({ success: true, group: newGroup });
});

// PUT /api/configs/:id — 更新配置组
app.put('/api/configs/:id', async (req, res) => {
  const { name, provider, apiKey, baseUrl } = req.body;
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  if (name) groups[idx].name = name;
  if (provider) groups[idx].provider = provider;
  if (apiKey !== undefined) groups[idx].apiKey = apiKey;
  if (baseUrl !== undefined) groups[idx].baseUrl = baseUrl;

  writeGroups(groups);
  syncYaml();
  syncEnvFile(groups[idx]);
  await notifyProxy();

  res.json({ success: true, group: groups[idx] });
});

// DELETE /api/configs/:id — 删除配置组
app.delete('/api/configs/:id', async (req, res) => {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  groups.splice(idx, 1);
  writeGroups(groups);
  syncYaml();

  const active = readActive();
  if (active.activeGroupId === req.params.id) {
    writeActive({ activeGroupId: null, activeModel: null });
  }

  await notifyProxy();
  res.json({ success: true });
});

// POST /api/configs/:id/models — 给组添加模型
app.post('/api/configs/:id/models', async (req, res) => {
  const { models } = req.body;
  if (!models || (typeof models === 'string' ? !models.trim() : models.length === 0)) {
    return res.status(400).json({ error: '请提供模型名称' });
  }

  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  let newModels = typeof models === 'string'
    ? models.split(',').map(m => m.trim()).filter(Boolean)
    : models;

  const already = newModels.filter(m => groups[idx].models.includes(m));
  if (already.length > 0) return res.status(409).json({ error: '模型 ' + already.join(', ') + ' 已存在' });

  groups[idx].models.push(...newModels);
  if (!groups[idx].activeModel && groups[idx].models.length > 0) {
    groups[idx].activeModel = groups[idx].models[0];
  }

  writeGroups(groups);
  syncYaml();

  const active = readActive();
  if (active.activeGroupId === req.params.id) syncEnvFile(groups[idx]);
  await notifyProxy();

  res.status(201).json({ success: true, added: newModels, group: groups[idx] });
});

// DELETE /api/configs/:id/models/:model — 从组里删除单个模型
app.delete('/api/configs/:id/models/:model', async (req, res) => {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  const modelIdx = groups[idx].models.indexOf(req.params.model);
  if (modelIdx === -1) return res.status(404).json({ error: '模型不存在' });

  groups[idx].models.splice(modelIdx, 1);

  if (groups[idx].activeModel === req.params.model) {
    groups[idx].activeModel = groups[idx].models[0] || null;
  }
  if (groups[idx].models.length === 0) {
    groups.splice(idx, 1);
    const active = readActive();
    if (active.activeGroupId === req.params.id) {
      writeActive({ activeGroupId: null, activeModel: null });
    }
  } else {
    const active = readActive();
    if (active.activeGroupId === req.params.id) syncEnvFile(groups[idx]);
  }

  writeGroups(groups);
  syncYaml();
  await notifyProxy();

  res.json({ success: true });
});

// POST /api/configs/:id/activate — 激活配置组
app.post('/api/configs/:id/activate', async (req, res) => {
  const groups = readGroups();
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: '配置组不存在' });

  const model = group.activeModel || group.models[0];
  writeActive({ activeGroupId: group.id, activeModel: model });
  syncEnvFile(group);
  await notifyProxy();

  res.json({ success: true, activeGroupId: group.id, activeModel: model });
});

// POST /api/configs/:id/models/:model/activate — 激活组内指定模型
app.post('/api/configs/:id/models/:model/activate', async (req, res) => {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  if (!groups[idx].models.includes(req.params.model)) {
    return res.status(404).json({ error: '模型不存在' });
  }

  groups[idx].activeModel = req.params.model;
  writeGroups(groups);
  writeActive({ activeGroupId: groups[idx].id, activeModel: req.params.model });
  syncEnvFile(groups[idx]);
  await notifyProxy();

  res.json({ success: true, activeGroupId: groups[idx].id, activeModel: req.params.model });
});

// GET /api/settings — 返回 YAML 内容
app.get('/api/settings', (req, res) => {
  const yamlPath = getConfigPath();
  if (fs.existsSync(yamlPath)) {
    res.json({ yaml: fs.readFileSync(yamlPath, 'utf8') });
  } else {
    res.json({ yaml: '# 暂无配置\nmodel_list: []' });
  }
});

// GET /api/providers — 返回提供商模板
app.get('/api/providers', (req, res) => res.json(PROVIDER_TEMPLATES));

// ── 启动 ────────────────────────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\u2705 模型配置管理器已启动: http://localhost:${PORT}`);
  console.log(`\u2705 代理服务: http://localhost:${PROXY_PORT}`);
});
