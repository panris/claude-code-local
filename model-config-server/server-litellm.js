const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const app2 = express();
app2.use(cors());
app2.use(express.json());
const PORT2 = 3001;

const app3 = express();
app3.use(cors());
app3.use(express.json());
const PORT3 = 3002;

const app4 = express();
app4.use(cors());
app4.use(express.json());
const PORT4 = 3003;

const app5 = express();
app5.use(cors());
app5.use(express.json());
const PORT5 = 3004;

const app6 = express();
app6.use(cors());
app6.use(express.json());
const PORT6 = 3005;

const app7 = express();
app7.use(cors());
app7.use(express.json());
const PORT7 = 3006;

const app8 = express();
app8.use(cors());
app8.use(express.json());
const PORT8 = 3007;

const app9 = express();
app9.use(cors());
app9.use(express.json());
const PORT9 = 3008;

const app10 = express();
app10.use(cors());
app10.use(express.json());
const PORT10 = 3009;

const app11 = express();
app11.use(cors());
app11.use(express.json());
const PORT11 = 3010;

const app12 = express();
app12.use(cors());
app12.use(express.json());
const PORT12 = 3011;

const app13 = express();
app13.use(cors());
app13.use(express.json());
const PORT13 = 3012;

const app14 = express();
app14.use(cors());
app14.use(express.json());
const PORT14 = 3013;

const app15 = express();
app15.use(cors());
app15.use(express.json());
const PORT15 = 3014;

const app16 = express();
app16.use(cors());
app16.use(express.json());
const PORT16 = 3015;

const app17 = express();
app17.use(cors());
app17.use(express.json());
const PORT17 = 3016;

const app18 = express();
app18.use(cors());
app18.use(express.json());
const PORT18 = 3017;

const app19 = express();
app19.use(cors());
app19.use(express.json());
const PORT19 = 3018;

const app20 = express();
app20.use(cors());
app20.use(express.json());
const PORT20 = 3019;

const app21 = express();
app21.use(cors());
app21.use(express.json());
const PORT21 = 3020;

const app22 = express();
app22.use(cors());
app22.use(express.json());
const PORT22 = 3021;

const app23 = express();
app23.use(cors());
app23.use(express.json());
const PORT23 = 3022;

const app24 = express();
app24.use(cors());
app24.use(express.json());
const PORT24 = 3023;

const app25 = express();
app25.use(cors());
app25.use(express.json());
const PORT25 = 3024;

const app26 = express();
app26.use(cors());
app26.use(express.json());
const PORT26 = 3025;

const app27 = express();
app27.use(cors());
app27.use(express.json());
const PORT27 = 3026;

const app28 = express();
app28.use(cors());
app28.use(express.json());
const PORT28 = 3027;

const app29 = express();
app29.use(cors());
app29.use(express.json());
const PORT29 = 3028;

const app30 = express();
app30.use(cors());
app30.use(express.json());
const PORT30 = 3029;

const app31 = express();
app31.use(cors());
app31.use(express.json());
const PORT31 = 3030;

const app32 = express();
app32.use(cors());
app32.use(express.json());
const PORT32 = 3031;

const app33 = express();
app33.use(cors());
app33.use(express.json());
const PORT33 = 3032;

const app34 = express();
app34.use(cors());
app34.use(express.json());
const PORT34 = 3033;

const app35 = express();
app35.use(cors());
app35.use(express.json());
const PORT35 = 3034;

const app36 = express();
app36.use(cors());
app36.use(express.json());
const PORT36 = 3035;

const app37 = express();
app37.use(cors());
app37.use(express.json());
const PORT37 = 3036;

const app38 = express();
app38.use(cors());
app38.use(express.json());
const PORT38 = 3037;

const app39 = express();
app39.use(cors());
app39.use(express.json());
const PORT39 = 3038;

const app40 = express();
app40.use(cors());
app40.use(express.json());
const PORT40 = 3039;

const app41 = express();
app41.use(cors());
app41.use(express.json());
const PORT41 = 3040;

const app42 = express();
app42.use(cors());
app42.use(express.json());
const PORT42 = 3041;

const app43 = express();
app43.use(cors());
app43.use(express.json());
const PORT43 = 3042;

const app44 = express();
app44.use(cors());
app44.use(express.json());
const PORT44 = 3043;

const app45 = express();
app45.use(cors());
app45.use(express.json());
const PORT45 = 3044;

const app46 = express();
app46.use(cors());
app46.use(express.json());
const PORT46 = 3045;

const app47 = express();
app47.use(cors());
app47.use(express.json());
const PORT47 = 3046;

const app48 = express();
app48.use(cors());
app48.use(express.json());
const PORT48 = 3047;

const app49 = express();
app49.use(cors());
app49.use(express.json());
const PORT49 = 3048;

const app50 = express();
app50.use(cors());
app50.use(express.json());
const PORT50 = 3049;

// LiteLLM 配置
const LITELLM_PORT = 12654;
const LITELLM_HOST = '127.0.0.1';
const LITELLM_URL = `http://${LITELLM_HOST}:${LITELLM_PORT}`;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || 'sk-claude-local';

// ── 文件路径 ─────────────────────────────────────────────
function getGroupsPath() {
  return path.join(os.homedir(), '.claude', 'config-groups.json');
}

function getConfigPath() {
  return path.join(os.homedir(), '.claude', 'litellm_config.yaml');
}

function getActivePath() {
  return path.join(os.homedir(), '.claude', 'active-model.json');
}

// ── JSON 配置读写（主数据）─────────────────────────────────
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

// ── 迁移旧 YAML → JSON（一次性）─────────────────────────────
function migrateFromYaml() {
  const yamlPath = getConfigPath();
  if (!fs.existsSync(yamlPath)) return;
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
    const groups = modelList.map(m => ({
      id: m.model_name,
      name: m.model_name,
      provider: detectProvider(m.litellm_params.api_base || '').id,
      apiKey: m.litellm_params.api_key || '',
      baseUrl: m.litellm_params.api_base || '',
      models: [m.model_name],
      activeModel: m.model_name
    }));
    const existing = readGroups();
    if (existing.length === 0) writeGroups(groups);
  } catch (e) { /* 迁移失败静默跳过 */ }
}

// ── YAML 同步（供 LiteLLM 使用）────────────────────────────
function syncYaml() {
  const groups = readGroups();
  const lines = ['# LiteLLM 配置文件', '# 由 Claude Code 模型管理器自动生成', '', 'model_list:'];
  groups.forEach(g => {
    g.models.forEach(modelName => {
      lines.push(`  - model_name: ${modelName}`);
      lines.push('    litellm_params:');
      lines.push(`      model: openai/${modelName}`);
      lines.push(`      api_base: ${g.baseUrl}`);
      lines.push(`      api_key: ${g.apiKey}`);
    });
  });
  lines.push('', 'general_settings:');
  lines.push(`  master_key: ${LITELLM_MASTER_KEY}`);
  lines.push('', 'litellm_settings:');
  lines.push('  drop_params: true');
  lines.push('  disable_auth: true');
  const yamlPath = getConfigPath();
  const dir = path.dirname(yamlPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(yamlPath, lines.join('\n'), 'utf8');
}

// ── 检测提供商 ─────────────────────────────────────────────
function detectProvider(baseUrl) {
  if (!baseUrl) return { id: 'custom', name: '自定义 API' };
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) return { id: 'kimi', name: 'Kimi' };
  if (baseUrl.includes('deepseek')) return { id: 'deepseek', name: 'DeepSeek' };
  if (baseUrl.includes('dashscope') || baseUrl.includes('aliyun')) return { id: 'qwen', name: '通义千问' };
  if (baseUrl.includes('bigmodel') || baseUrl.includes('zhipu')) return { id: 'zhipu', name: '智谱 GLM' };
  if (baseUrl.includes('openai.com')) return { id: 'openai', name: 'OpenAI' };
  if (baseUrl.includes('anthropic.com')) return { id: 'anthropic', name: 'Anthropic' };
  if (baseUrl.includes('volces.com')) return { id: 'ark', name: '火山引擎 ARK' };
  if (baseUrl.includes('localhost:11434')) return { id: 'ollama', name: 'Ollama (本地)' };
  return { id: 'custom', name: '自定义 API' };
}

// ── 重启 LiteLLM ──────────────────────────────────────────
function reloadLiteLLM() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: LITELLM_HOST, port: LITELLM_PORT, path: '/health', method: 'GET' }, () => resolve());
    req.on('error', () => resolve());
    req.end();
    setTimeout(resolve, 500);
  });
}

// ── .env 同步 ─────────────────────────────────────────────
function syncEnvFile(group) {
  const envPath = path.join(os.homedir(), '.claude', '.env');
  const model = group.activeModel || (group.models.length > 0 ? group.models[0] : '');
  const lines = [
    '# Claude Code 环境变量配置',
    '# 由模型配置管理器自动生成 ' + new Date().toISOString(),
    '# 当前激活配置: ' + group.name + ' / ' + model,
    '',
    'CLAUDE_MODEL=' + model,
    'CUSTOM_API_KEY=' + (group.apiKey || ''),
    'CUSTOM_BASE_URL=' + (group.baseUrl || ''),
    'OPENAI_API_KEY=' + (group.apiKey || ''),
    'OPENAI_BASE_URL=' + (group.baseUrl || ''),
    '',
    '# LiteLLM master key（本地代理认证）',
    'LITELLM_MASTER_KEY=' + LITELLM_MASTER_KEY,
  ];
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// ── 提供商模板 ─────────────────────────────────────────────
const PROVIDER_TEMPLATES = {
  kimi: { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k2.6', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-air'] },
  ark: { name: '火山引擎 ARK', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: [] },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'] },
  anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-opus-4-6'] },
  ollama: { name: 'Ollama (本地)', baseUrl: 'http://localhost:11434', models: ['llama3', 'qwen2.5', 'gemma2'] },
  custom: { name: '自定义 API', baseUrl: '', models: [] }
};

// ── 激活状态 ──────────────────────────────────────────────
function getActivePath() {
  return path.join(os.homedir(), '.claude', 'active-model.json');
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

// 启动时迁移旧 YAML
migrateFromYaml();

// ── API 路由 ──────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/configs — 返回所有配置组
app.get('/api/configs', (req, res) => {
  const groups = readGroups();
  const active = readActive();
  res.json({
    configs: groups,
    activeGroupId: active.activeGroupId,
    activeModel: active.activeModel
  });
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

  // models 可能是字符串（逗号分隔）或数组
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
    name,
    provider,
    apiKey,
    baseUrl: finalBaseUrl,
    models: modelList,
    activeModel: modelList[0]
  };

  groups.push(newGroup);
  writeGroups(groups);
  syncYaml();
  syncEnvFile(newGroup);

  try { await reloadLiteLLM(); } catch {}
  res.status(201).json({ success: true, group: newGroup });
});

// PUT /api/configs/:id — 更新配置组
app.put('/api/configs/:id', async (req, res) => {
  const { name, provider, apiKey, baseUrl } = req.body;
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  if (name) groups[idx].name = name;
  if (provider) {
    groups[idx].provider = provider;
    if (!groups[idx].baseUrl) {
      groups[idx].baseUrl = (PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom).baseUrl;
    }
  }
  if (apiKey !== undefined) groups[idx].apiKey = apiKey;
  if (baseUrl !== undefined) groups[idx].baseUrl = baseUrl;

  writeGroups(groups);
  syncYaml();
  syncEnvFile(groups[idx]);

  try { await reloadLiteLLM(); } catch {}
  res.json({ success: true, group: groups[idx] });
});

// DELETE /api/configs/:id — 删除配置组
app.delete('/api/configs/:id', async (req, res) => {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  const removed = groups.splice(idx, 1)[0];
  writeGroups(groups);
  syncYaml();

  // 如果删除的是当前激活组，清除激活状态
  const active = readActive();
  if (active.activeGroupId === req.params.id) {
    writeActive({ activeGroupId: null, activeModel: null });
  }

  try { await reloadLiteLLM(); } catch {}
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

  let newModels = [];
  if (typeof models === 'string') {
    newModels = models.split(',').map(m => m.trim()).filter(Boolean);
  } else if (Array.isArray(models)) {
    newModels = models;
  }

  const already = newModels.filter(m => groups[idx].models.includes(m));
  if (already.length > 0) return res.status(409).json({ error: '模型 ' + already.join(', ') + ' 已存在' });

  groups[idx].models.push(...newModels);
  // 如果当前没有 activeModel，设第一个
  if (!groups[idx].activeModel && groups[idx].models.length > 0) {
    groups[idx].activeModel = groups[idx].models[0];
  }

  writeGroups(groups);
  syncYaml();

  // 如果是当前激活组，同步 .env
  const active = readActive();
  if (active.activeGroupId === req.params.id) {
    syncEnvFile(groups[idx]);
  }

  try { await reloadLiteLLM(); } catch {}
  res.status(201).json({ success: true, added: newModels, group: groups[idx] });
});

// DELETE /api/configs/:id/models/:model — 从组里删除单个模型
app.delete('/api/configs/:id/models/:model', async (req, res) => {
  const groups = readGroups();
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '配置组不存在' });

  const modelIdx = groups[idx].models.indexOf(req.params.model);
  if (modelIdx === -1) return res.status(404).json({ error: '模型不存在' });

  const removed = groups[idx].models.splice(modelIdx, 1)[0];

  // 如果删除的是 activeModel，重设
  if (groups[idx].activeModel === removed) {
    groups[idx].activeModel = groups[idx].models[0] || null;
  }

  // 如果组里没模型了，删除整组
  if (groups[idx].models.length === 0) {
    groups.splice(idx, 1);
    const active = readActive();
    if (active.activeGroupId === req.params.id) {
      writeActive({ activeGroupId: null, activeModel: null });
    }
  } else {
    const active = readActive();
    if (active.activeGroupId === req.params.id) {
      syncEnvFile(groups[idx]);
    }
  }

  writeGroups(groups);
  syncYaml();

  try { await reloadLiteLLM(); } catch {}
  res.json({ success: true });
});

// POST /api/configs/:id/activate — 激活配置组（激活第一个模型）
app.post('/api/configs/:id/activate', async (req, res) => {
  const groups = readGroups();
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: '配置组不存在' });

  const model = group.activeModel || group.models[0];
  writeActive({ activeGroupId: group.id, activeModel: model });
  syncEnvFile(group);

  try { await reloadLiteLLM(); } catch {}
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

  try { await reloadLiteLLM(); } catch {}
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

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`模型配置管理器已启动: http://localhost:${PORT}`);
});

