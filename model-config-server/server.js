const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 获取 Claude Code 配置目录
function getClaudeConfigDir() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.claude');
}

// 获取 settings.json 路径
function getSettingsPath() {
  return path.join(getClaudeConfigDir(), 'settings.json');
}

// 读取配置
function readSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      return {};
    }
    const content = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('读取配置失败:', error);
    return {};
  }
}

// 保存配置
function writeSettings(settings) {
  try {
    const configDir = getClaudeConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
}

// 收集所有模型到 availableModels
function collectAllModels(configs) {
  const models = new Set();
  configs.forEach(config => {
    if (config.models && config.models.length > 0) {
      config.models.forEach(m => models.add(m));
    }
  });
  return Array.from(models);
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取所有配置组
app.get('/api/configs', (req, res) => {
  const settings = readSettings();
  res.json({
    configs: settings.modelConfigs || [],
    activeConfig: settings.activeModelConfig || null
  });
});

// 获取单个配置
app.get('/api/configs/:name', (req, res) => {
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const config = configs.find(c => c.name === req.params.name);
  
  if (!config) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  res.json(config);
});

// 创建新配置组
app.post('/api/configs', (req, res) => {
  const { name, provider, apiKey, baseUrl, models } = req.body;
  
  if (!name || !provider || !apiKey) {
    return res.status(400).json({ 
      error: '缺少必要字段: name, provider, apiKey' 
    });
  }
  
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  
  // 检查名称是否已存在
  if (configs.some(c => c.name === name)) {
    return res.status(409).json({ error: '配置名称已存在' });
  }
  
  const newConfig = {
    name,
    provider,
    apiKey,
    baseUrl: baseUrl || null,
    models: models && models.length > 0 ? models : [],
    activeModel: models && models.length > 0 ? models[0] : null
  };
  
  configs.push(newConfig);
  settings.modelConfigs = configs;
  
  // 更新 availableModels
  settings.availableModels = collectAllModels(configs);
  
  // 第一个配置组自动激活
  if (!settings.activeModelConfig) {
    settings.activeModelConfig = name;
    settings.modelType = provider;
    settings.baseUrl = baseUrl || null;
    settings.apiKey = apiKey;
    settings.model = newConfig.activeModel || '';
    
    // 导出环境变量
    exportEnvVars(settings);
  }
  
  if (writeSettings(settings)) {
    res.status(201).json(newConfig);
  } else {
    res.status(500).json({ error: '保存配置失败' });
  }
});

// 更新配置组
app.put('/api/configs/:name', (req, res) => {
  const { provider, apiKey, baseUrl, models } = req.body;
  const name = req.params.name;
  
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const index = configs.findIndex(c => c.name === name);
  
  if (index === -1) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  const updatedConfig = {
    ...configs[index],
    ...(provider && { provider }),
    ...(apiKey && { apiKey }),
    baseUrl: baseUrl !== undefined ? baseUrl : configs[index].baseUrl,
    models: models || configs[index].models || [],
    activeModel: configs[index].activeModel
  };
  
  // 如果 activeModel 不在新的 models 列表中，重置
  if (updatedConfig.models.length > 0 && !updatedConfig.models.includes(updatedConfig.activeModel)) {
    updatedConfig.activeModel = updatedConfig.models[0];
  }
  
  configs[index] = updatedConfig;
  settings.modelConfigs = configs;
  
  // 更新 availableModels
  settings.availableModels = collectAllModels(configs);
  
  // 如果更新的是当前激活的配置，同步更新所有字段
  if (settings.activeModelConfig === name) {
    settings.modelType = updatedConfig.provider;
    settings.baseUrl = updatedConfig.baseUrl;
    settings.apiKey = updatedConfig.apiKey;
    settings.model = updatedConfig.activeModel;
    
    // 导出环境变量
    exportEnvVars(settings);
  }
  
  if (writeSettings(settings)) {
    res.json(updatedConfig);
  } else {
    res.status(500).json({ error: '保存配置失败' });
  }
});

// 删除配置组
app.delete('/api/configs/:name', (req, res) => {
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const index = configs.findIndex(c => c.name === req.params.name);
  
  if (index === -1) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  const deletedName = configs[index].name;
  configs.splice(index, 1);
  settings.modelConfigs = configs;
  
  // 更新 availableModels
  settings.availableModels = collectAllModels(configs);
  
  // 如果删除的是当前激活的配置，切换到第一个
  if (settings.activeModelConfig === deletedName) {
    if (configs.length > 0) {
      settings.activeModelConfig = configs[0].name;
      settings.modelType = configs[0].provider;
      settings.baseUrl = configs[0].baseUrl;
      settings.apiKey = configs[0].apiKey;
      settings.model = configs[0].activeModel || configs[0].models[0] || '';
    } else {
      settings.activeModelConfig = null;
      settings.modelType = null;
      settings.baseUrl = null;
      settings.apiKey = null;
      settings.model = null;
    }
    
    // 导出环境变量
    exportEnvVars(settings);
  }
  
  if (writeSettings(settings)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '删除配置失败' });
  }
});

// 导出环境变量到 .env 文件
function exportEnvVars(settings) {
  try {
    const config = settings.modelConfigs?.find(c => c.name === settings.activeModelConfig);
    if (!config) return;
    
    const envPath = path.join(getClaudeConfigDir(), '.env');
    const lines = [];
    
    lines.push(`# Claude Code 环境变量配置`);
    lines.push(`# 由模型配置管理器自动生成 ${new Date().toISOString()}`);
    lines.push(`# 当前激活配置: ${config.name}`);
    lines.push(``);
    
    // 导出 provider
    switch (config.provider) {
      case 'anthropic':
        lines.push(`ANTHROPIC_API_KEY=${config.apiKey}`);
        break;
      case 'openai':
        lines.push(`OPENAI_API_KEY=${config.apiKey}`);
        if (config.baseUrl) lines.push(`OPENAI_BASE_URL=${config.baseUrl}`);
        break;
      case 'gemini':
        lines.push(`GEMINI_API_KEY=${config.apiKey}`);
        if (config.baseUrl) lines.push(`GEMINI_BASE_URL=${config.baseUrl}`);
        break;
      case 'grok':
        lines.push(`GROK_API_KEY=${config.apiKey}`);
        if (config.baseUrl) lines.push(`GROK_BASE_URL=${config.baseUrl}`);
        break;
      case 'custom':
        lines.push(`CUSTOM_API_KEY=${config.apiKey}`);
        if (config.baseUrl) lines.push(`CUSTOM_BASE_URL=${config.baseUrl}`);
        // 判断是否为 Ollama 本地模型
        if (config.baseUrl && config.baseUrl.includes('localhost:11434')) {
          // Ollama 本地模型
          lines.push(`OLLAMA_BASE_URL=${config.baseUrl}`);
          lines.push(`OLLAMA_API_KEY=${config.apiKey}`);
          lines.push(`OLLAMA_MODEL=${config.activeModel}`);
          lines.push(`OPENAI_BASE_URL=${config.baseUrl}`);
          lines.push(`OPENAI_MODEL=${config.activeModel}`);
        } else {
          // 其他自定义 API（如豆包），使用 OpenAI 兼容格式
          lines.push(`OPENAI_API_KEY=${config.apiKey}`);
          if (config.baseUrl) lines.push(`OPENAI_BASE_URL=${config.baseUrl}`);
          lines.push(`OPENAI_MODEL=${config.activeModel}`);
          lines.push(`CLAUDE_CODE_USE_OPENAI=1`);
        }
        break;
      case 'ollama':
        lines.push(`OLLAMA_BASE_URL=${config.baseUrl || 'http://localhost:11434'}`);
        lines.push(`OLLAMA_API_KEY=${config.apiKey}`);
        lines.push(`OLLAMA_MODEL=${config.activeModel}`);
        lines.push(`OPENAI_BASE_URL=${config.baseUrl || 'http://localhost:11434'}`);
        lines.push(`OPENAI_MODEL=${config.activeModel}`);
        break;
    }
    
    // 导出模型
    if (config.activeModel) {
      lines.push(``);
      lines.push(`# 模型`);
      lines.push(`CLAUDE_MODEL=${config.activeModel}`);
      if (config.provider === 'openai' || config.provider === 'custom') {
        lines.push(`OPENAI_MODEL=${config.activeModel}`);
      }
      if (config.provider === 'gemini') {
        lines.push(`GEMINI_MODEL=${config.activeModel}`);
      }
      if (config.provider === 'grok') {
        lines.push(`GROK_MODEL=${config.activeModel}`);
      }
    }
    
    fs.writeFileSync(envPath, lines.join('\n') + '\n');
    console.log(`✅ 环境变量已导出到 ${envPath}`);
    
  } catch (error) {
    console.error('导出环境变量失败:', error);
  }
}

// 激活配置组
app.post('/api/configs/:name/activate', (req, res) => {
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const config = configs.find(c => c.name === req.params.name);
  
  if (!config) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  // 激活整个配置组
  settings.activeModelConfig = config.name;
  settings.modelType = config.provider;
  settings.baseUrl = config.baseUrl;
  settings.apiKey = config.apiKey;
  settings.model = config.activeModel || (config.models && config.models[0]) || '';
  
  // 导出环境变量
  exportEnvVars(settings);
  
  if (writeSettings(settings)) {
    res.json({ 
      success: true, 
      activeConfig: config.name,
      modelType: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: settings.model,
      envExported: true
    });
  } else {
    res.status(500).json({ error: '激活配置失败' });
  }
});

// 切换配置组中的模型
app.post('/api/configs/:name/switch-model', (req, res) => {
  const { model } = req.body;
  const name = req.params.name;
  
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const configIndex = configs.findIndex(c => c.name === name);
  
  if (configIndex === -1) {
    return res.status(404).json({ error: '配置不存在' });
  }
  
  // 更新配置组中激活的模型
  configs[configIndex].activeModel = model;
  settings.modelConfigs = configs;
  
  // 如果切换的是当前激活的配置组，同步更新 model
  if (settings.activeModelConfig === name) {
    settings.model = model;
    
    // 导出环境变量
    exportEnvVars(settings);
  }
  
  if (writeSettings(settings)) {
    res.json({ 
      success: true, 
      activeConfig: name,
      activeModel: model,
      model: settings.model,
      envExported: settings.activeModelConfig === name
    });
  } else {
    res.status(500).json({ error: '切换模型失败' });
  }
});

// 获取当前激活的配置
app.get('/api/active', (req, res) => {
  const settings = readSettings();
  const configs = settings.modelConfigs || [];
  const activeConfig = configs.find(c => c.name === settings.activeModelConfig);
  
  res.json({
    activeConfig: settings.activeModelConfig,
    modelType: settings.modelType,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    config: activeConfig || null,
    availableModels: settings.availableModels || []
  });
});

// 获取 settings.json 完整内容
app.get('/api/settings', (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    configPath: getSettingsPath(),
    envPath: path.join(getClaudeConfigDir(), '.env')
  });
});

// 前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Claude Code 模型配置管理服务器                      ║
╠════════════════════════════════════════════════════════╣
║  访问地址:                                             ║
║    - 本机: http://localhost:${PORT}                      ║
║    - 局域网: http://${getLocalIP()}:${PORT}                ║
╠════════════════════════════════════════════════════════╣
║  配置文件: ${getSettingsPath()}
║  环境变量: ${path.join(getClaudeConfigDir(), '.env')}
╚════════════════════════════════════════════════════════╝
  `);
});

// 获取本机 IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
