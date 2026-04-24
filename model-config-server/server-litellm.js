const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// LiteLLM 配置
const LITELLM_PORT = 12654;
const LITELLM_HOST = '127.0.0.1';
const LITELLM_URL = `http://${LITELLM_HOST}:${LITELLM_PORT}`;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || 'sk-claude-local';

// 配置文件路径
function getConfigPath() {
  return path.join(os.homedir(), '.claude', 'litellm_config.yaml');
}

// 激活状态持久化
function getActivePath() {
  return path.join(os.homedir(), '.claude', 'active-model.json');
}

function readActive() {
  try {
    const p = getActivePath();
    if (!fs.existsSync(p)) return { activeConfig: null, model: null };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return { activeConfig: null, model: null }; }
}

function writeActive(activeConfig, model) {
  const dir = path.dirname(getActivePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getActivePath(), JSON.stringify({ activeConfig, model, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

// 提供商配置模板
const PROVIDER_TEMPLATES = {
  kimi: { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k2.6', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-air'] },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'] },
  anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-opus-4-6'] },
  ollama: { name: 'Ollama (本地)', baseUrl: 'http://localhost:11434', models: ['llama3', 'qwen2.5', 'gemma2'] },
  custom: { name: '自定义 API', baseUrl: '', models: [] }
};

// 解析 YAML（简化版）
function parseYaml(content) {
  const config = { model_list: [], general_settings: { master_key: LITELLM_MASTER_KEY } };
  let currentModel = null;
  let inModelParams = false;
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') return;
    
    if (trimmed.startsWith('- model_name:')) {
      if (currentModel) config.model_list.push(currentModel);
      currentModel = { model_name: trimmed.replace('- model_name:', '').trim(), litellm_params: {} };
      inModelParams = false;
    } else if (trimmed === 'litellm_params:') {
      inModelParams = true;
    } else if (currentModel && inModelParams) {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) currentModel.litellm_params[match[1]] = match[2].replace(/['"]/g, '');
    } else if (trimmed.startsWith('master_key:')) {
      config.general_settings.master_key = trimmed.replace('master_key:', '').trim().replace(/['"]/g, '');
    }
  });
  
  if (currentModel) config.model_list.push(currentModel);
  return config;
}

// 序列化为 YAML
function serializeYaml(config) {
  const lines = ['# LiteLLM 配置文件', '# 由 Claude Code 模型管理器自动生成', '', 'model_list:'];
  
  config.model_list.forEach(m => {
    lines.push(`  - model_name: ${m.model_name}`);
    lines.push('    litellm_params:');
    Object.entries(m.litellm_params).forEach(([k, v]) => lines.push(`      ${k}: ${v}`));
  });
  
  lines.push('', 'general_settings:', `  master_key: ${config.general_settings.master_key || LITELLM_MASTER_KEY}`);
  lines.push('', 'litellm_settings:', '  drop_params: true', '  set_verbose: false', '');
  
  return lines.join('\n');
}

// 读写配置
function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return { model_list: [], general_settings: { master_key: LITELLM_MASTER_KEY } };
  return parseYaml(fs.readFileSync(configPath, 'utf8'));
}

function writeConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, serializeYaml(config), 'utf8');
}

// 检测提供商
function detectProvider(baseUrl) {
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) return { id: 'kimi', name: 'Kimi' };
  if (baseUrl.includes('deepseek')) return { id: 'deepseek', name: 'DeepSeek' };
  if (baseUrl.includes('dashscope') || baseUrl.includes('aliyun')) return { id: 'qwen', name: '通义千问' };
  if (baseUrl.includes('bigmodel') || baseUrl.includes('zhipu')) return { id: 'zhipu', name: '智谱 GLM' };
  if (baseUrl.includes('openai.com')) return { id: 'openai', name: 'OpenAI' };
  if (baseUrl.includes('anthropic.com')) return { id: 'anthropic', name: 'Anthropic' };
  if (baseUrl.includes('localhost:11434')) return { id: 'ollama', name: 'Ollama (本地)' };
  return { id: 'custom', name: '自定义' };
}

// 重载 LiteLLM
async function reloadLiteLLM() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: LITELLM_HOST,
      port: LITELLM_PORT,
      path: '/model/reload',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` }
    }, res => {
      res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`状态码 ${res.statusCode}`));
    });
    req.on('error', reject);
    req.end();
  });
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.get('/api/configs', (req, res) => {
  const config = readConfig();
  const active = readActive();
  const configs = config.model_list.map(m => {
    const params = m.litellm_params || {};
    const provider = detectProvider(params.api_base || '');
    return { name: m.model_name, provider: provider.id, providerName: provider.name, apiKey: params.api_key || '', baseUrl: params.api_base || '', models: [m.model_name], activeModel: m.model_name };
  });
  res.json({ configs, activeConfig: active.activeConfig, activeModel: active.model });
});

app.get('/api/configs/:name', (req, res) => {
  const config = readConfig();
  const model = config.model_list.find(m => m.model_name === req.params.name);
  if (!model) return res.status(404).json({ error: '配置不存在' });
  const params = model.litellm_params || {};
  const provider = detectProvider(params.api_base || '');
  res.json({ name: model.model_name, provider: provider.id, apiKey: params.api_key || '', baseUrl: params.api_base || '', models: [model.model_name], activeModel: model.model_name });
});

app.post('/api/configs', async (req, res) => {
  const { name, provider, apiKey, baseUrl, models } = req.body;
  if (!name || !provider || !apiKey) return res.status(400).json({ error: '缺少必要字段' });
  
  const config = readConfig();
  if (config.model_list.some(m => m.model_name === name)) return res.status(409).json({ error: '模型名称已存在' });
  
  const template = PROVIDER_TEMPLATES[provider] || PROVIDER_TEMPLATES.custom;
  const finalBaseUrl = baseUrl || template.baseUrl;
  const modelNames = models?.length > 0 ? models : template.models;
  
  modelNames.forEach(modelName => {
    config.model_list.push({ model_name: modelName, litellm_params: { model: `openai/${modelName}`, api_base: finalBaseUrl, api_key: apiKey } });
  });
  
  writeConfig(config);
  try { await reloadLiteLLM(); res.status(201).json({ success: true, created: modelNames.length, models: modelNames }); }
  catch (e) { res.status(201).json({ success: true, created: modelNames.length, models: modelNames, warning: '配置已保存，请手动重启 LiteLLM' }); }
});

app.put('/api/configs/:name', async (req, res) => {
  const { apiKey, baseUrl } = req.body;
  const config = readConfig();
  const model = config.model_list.find(m => m.model_name === req.params.name);
  if (!model) return res.status(404).json({ error: '配置不存在' });
  
  if (apiKey) model.litellm_params.api_key = apiKey;
  if (baseUrl) model.litellm_params.api_base = baseUrl;
  
  writeConfig(config);
  try { await reloadLiteLLM(); res.json({ success: true }); }
  catch (e) { res.json({ success: true, warning: '配置已更新，请手动重启 LiteLLM' }); }
});

app.delete('/api/configs/:name', async (req, res) => {
  const config = readConfig();
  const index = config.model_list.findIndex(m => m.model_name === req.params.name);
  if (index === -1) return res.status(404).json({ error: '配置不存在' });
  
  config.model_list.splice(index, 1);
  writeConfig(config);
  try { await reloadLiteLLM(); res.json({ success: true }); }
  catch (e) { res.json({ success: true, warning: '配置已删除，请手动重启 LiteLLM' }); }
});

// ── 同步写入 .env（proxy.js 读这个文件）─────────────────────────────
function syncEnvFile(configName, model, apiKey, baseUrl) {
  const envPath = path.join(os.homedir(), '.claude', '.env');
  const lines = [
    '# Claude Code 环境变量配置',
    '# 由模型配置管理器自动生成 ' + new Date().toISOString(),
    '# 当前激活配置: ' + configName,
    '',
    'CUSTOM_API_KEY=' + (apiKey || ''),
    'CUSTOM_BASE_URL=' + (baseUrl || ''),
    'OPENAI_API_KEY=' + (apiKey || ''),
    'OPENAI_BASE_URL=' + (baseUrl || ''),
    'OPENAI_MODEL=' + (model || ''),
    'CLAUDE_CODE_USE_OPENAI=1',
    'CLAUDE_MODEL=' + (model || ''),
    ''
  ];
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  console.log('已同步 .env: model=' + model + ' baseUrl=' + baseUrl);
}

app.post('/api/configs/:name/activate', (req, res) => {
  const config = readConfig();
  const modelEntry = config.model_list.find(m => m.model_name === req.params.name);
  if (modelEntry) {
    const params = modelEntry.litellm_params || {};
    const model = modelEntry.model_name;
    syncEnvFile(req.params.name, model, params.api_key || '', params.api_base || '');
    writeActive(req.params.name, model);
  }
  res.json({ success: true, activeConfig: req.params.name, activeModel: modelEntry ? modelEntry.model_name : null, hint: '已激活，proxy 下次请求自动生效' });
});

app.post('/api/configs/:name/switch-model', (req, res) => {
  const { model } = req.body;
  const config = readConfig();
  let apiKey = '', baseUrl = '';
  const modelEntry = config.model_list.find(m => m.model_name === model);
  if (modelEntry) {
    const params = modelEntry.litellm_params || {};
    apiKey = params.api_key || '';
    baseUrl = params.api_base || '';
  } else {
    const currentConfig = config.model_list.find(m => m.model_name === req.params.name);
    if (currentConfig) {
      const params = currentConfig.litellm_params || {};
      apiKey = params.api_key || '';
      baseUrl = params.api_base || '';
    }
  }
  syncEnvFile(req.params.name, model, apiKey, baseUrl);
  writeActive(req.params.name, model);
  res.json({ success: true, activeConfig: req.params.name, model: model, hint: '已切换，proxy 下次请求自动生效' });
});

app.get('/api/active', (req, res) => {
  const config = readConfig();
  const active = readActive();
  // 从 .env 读实际的代理配置（proxy.js 用这个）
  let proxyBaseUrl = '', proxyApiKey = '', proxyModel = '';
  try {
    const envPath = path.join(os.homedir(), '.claude', '.env');
    if (fs.existsSync(envPath)) {
      fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx === -1) return;
        const k = line.slice(0, idx).trim(), v = line.slice(idx + 1).trim();
        if (k === 'OPENAI_BASE_URL') proxyBaseUrl = v;
        if (k === 'OPENAI_API_KEY') proxyApiKey = v;
        if (k === 'OPENAI_MODEL') proxyModel = v;
      });
    }
  } catch {}
  res.json({
    activeConfig: active.activeConfig,
    model: active.model || proxyModel,
    baseUrl: LITELLM_URL,
    apiKey: LITELLM_MASTER_KEY,
    proxyBaseUrl,
    proxyApiKey: proxyApiKey ? proxyApiKey.slice(0, 8) + '...' : '',
    proxyModel,
    availableModels: config.model_list.map(m => m.model_name)
  });
});

app.get('/api/settings', (req, res) => {
  res.json({ litellm: readConfig(), endpoint: LITELLM_URL, apiKey: LITELLM_MASTER_KEY });
});

app.get('/api/providers', (req, res) => res.json(PROVIDER_TEMPLATES));

app.get('/api/health', async (req, res) => {
  let status = 'offline';
  try {
    const resp = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: LITELLM_HOST, port: LITELLM_PORT, path: '/health', method: 'GET', headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` } }, resolve);
      req.on('error', () => reject());
      req.end();
    });
    status = resp.statusCode === 200 ? 'ok' : 'error';
  } catch {}
  
  res.json({ status: 'ok', timestamp: new Date().toISOString(), configPath: getConfigPath(), litellm: { url: LITELLM_URL, status } });
});

// 前端页面
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 模型配置管理服务器已启动\n   地址: http://localhost:${PORT}\n   LiteLLM: ${LITELLM_URL}\n   配置: ${getConfigPath()}\n`);
});
