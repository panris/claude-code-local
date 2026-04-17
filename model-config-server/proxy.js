const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const PROXY_PORT = process.env.PROXY_PORT || 11435;
const HOST = '0.0.0.0';

// 获取配置
function getConfig() {
  try {
    const envPath = path.join(os.homedir(), '.claude', '.env');
    if (!fs.existsSync(envPath)) {
      return null;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        config[match[1].trim()] = match[2].trim();
      }
    });
    return config;
  } catch (error) {
    console.error('读取配置失败:', error);
    return null;
  }
}

// 判断是否为 Ollama 本地地址
function isOllamaUrl(baseUrl) {
  return baseUrl && (
    baseUrl.includes('localhost:11434') ||
    baseUrl.includes('127.0.0.1:11434') ||
    baseUrl.includes('ollama')
  );
}

// 判断是否为 OpenAI 兼容地址
function isOpenAICompatible(baseUrl) {
  return baseUrl && baseUrl.includes('/v1/');
}

// 解析 URL
function parseUrl(urlStr) {
  try {
    return new URL(urlStr);
  } catch {
    return null;
  }
}

// Ollama 原生 API 请求
function ollamaChatRequest(model, messages, callback) {
  const config = getConfig();
  if (!config) {
    callback({ error: '未配置模型' });
    return;
  }

  const baseUrl = config.OLLAMA_BASE_URL || 'http://localhost:11434';
  const url = parseUrl(`${baseUrl}/api/chat`);

  const requestBody = {
    model: model || config.OLLAMA_MODEL || 'qwen3.5:9b',
    messages: messages,
    stream: false,
    options: {
      temperature: 0.7
    }
  };

  const options = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        // 转换 Ollama 格式为 OpenAI 格式
        if (data.message) {
          callback({
            id: `ollama-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: data.model || requestBody.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: data.message.content
              },
              finish_reason: 'stop'
            }],
            usage: data.eval_count ? {
              prompt_tokens: data.prompt_eval_count,
              completion_tokens: data.eval_count,
              total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            } : undefined
          });
        } else if (data.error) {
          callback({ error: data.error });
        } else {
          callback(data);
        }
      } catch (e) {
        callback({ error: `解析响应失败: ${e.message}`, raw: body });
      }
    });
  });

  req.on('error', (e) => {
    callback({ error: `请求失败: ${e.message}` });
  });

  req.write(JSON.stringify(requestBody));
  req.end();
}

// OpenAI 兼容格式请求
function openAIRequest(baseUrl, apiKey, model, requestBody, callback) {
  const url = parseUrl(`${baseUrl}/chat/completions`);

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey || 'test'}`
    }
  };

  // 替换模型名称
  const body = { ...requestBody, model: model };

  const client = url.protocol === 'https:' ? https : http;
  const req = client.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        callback(JSON.parse(body));
      } catch (e) {
        callback({ error: `解析响应失败: ${e.message}`, raw: body });
      }
    });
  });

  req.on('error', (e) => {
    callback({ error: `请求失败: ${e.message}` });
  });

  req.write(JSON.stringify(body));
  req.end();
}

// 创建代理服务器
const server = http.createServer((req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 只处理 /v1/chat/completions
  if (!req.url.includes('/v1/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only /v1/chat/completions is supported' }));
    return;
  }

  const config = getConfig();
  
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '未配置模型，请先在 Web 界面激活配置' }));
    return;
  }

  const baseUrl = config.OPENAI_BASE_URL || config.OLLAMA_BASE_URL || 'http://localhost:11434';
  const apiKey = config.OPENAI_API_KEY || config.OLLAMA_API_KEY || 'test';
  const model = config.OPENAI_MODEL || config.OLLAMA_MODEL || '';

  console.log(`\n📡 代理请求`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   模型: ${model}`);

  // 读取请求体
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const requestBody = JSON.parse(body);
      
      // 根据 baseUrl 选择不同的请求方式
      if (isOllamaUrl(baseUrl)) {
        console.log(`   模式: Ollama 原生 API`);
        
        // 转换 OpenAI 格式为 Ollama 格式
        const messages = requestBody.messages || [];
        constollamaChatRequest(model, messages, (result) => {
          if (result.error) {
            console.log(`   ❌ 错误: ${result.error}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error }));
          } else {
            console.log(`   ✅ 成功`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        });
      } else {
        console.log(`   模式: OpenAI 兼容 API`);
        
        openAIRequest(baseUrl, apiKey, model, requestBody, (result) => {
          if (result.error) {
            console.log(`   ❌ 错误: ${result.error?.message || result.error}`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            console.log(`   ✅ 成功`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        });
      }
    } catch (e) {
      console.log(`   ❌ 解析请求失败: ${e.message}`);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `解析请求失败: ${e.message}` }));
    }
  });
});

server.listen(PROXY_PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║     Claude Code 模型动态代理服务器                     ║
╠════════════════════════════════════════════════════════╣
║  代理地址: http://localhost:${PROXY_PORT}              ║
║  支持: Ollama 原生 API + OpenAI 兼容 API             ║
╠════════════════════════════════════════════════════════╣
║  配置: ~/.claude/.env                              ║
╚════════════════════════════════════════════════════════╝
  `);
});
