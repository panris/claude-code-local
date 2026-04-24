/**
 * Claude Proxy — Anthropic 兼容 API 代理
 * 
 * 支持两种端点：
 *   POST /v1/messages        (Anthropic 原生格式)
 *   POST /v1/chat/completions (OpenAI 兼容格式)
 *
 * 监听端口: 12654
 * 配置: ~/.claude/.env
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 配置 ────────────────────────────────────────────────────────────
const PROXY_PORT = 12654;
const HOST = '0.0.0.0';

// ── 模型名称映射 ──────────────────────────────────────────────────────
// Claude Code 使用 claude-* 模型名，需要映射到实际模型
function mapModel(requestedModel, configModel) {
  // 如果是 claude-* 格式，使用配置的实际模型
  if (requestedModel && requestedModel.startsWith('claude-')) {
    return configModel || requestedModel;
  }
  // 否则使用请求的模型（如果有）或配置的模型
  return requestedModel || configModel;
}

// ── 读取 .env 配置 ───────────────────────────────────────────────────
function getConfig() {
  try {
    const envPath = path.join(os.homedir(), '.claude', '.env');
    if (!fs.existsSync(envPath)) return null;
    const content = fs.readFileSync(envPath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return config;
  } catch (e) {
    return null;
  }
}

// ── URL 解析 ────────────────────────────────────────────────────────
function parseUrl(urlStr) {
  try { return new URL(urlStr); } catch { return null; }
}

// ── Ollama 判断 ─────────────────────────────────────────────────────
function isOllamaUrl(url) {
  return url && (url.includes('localhost:11434') || url.includes('127.0.0.1:11434'));
}

// ── Anthropic → Ollama 格式转换 ────────────────────────────────────
function anthropicToOllama(messages, systemPrompt) {
  const ollamaMessages = [];
  if (systemPrompt) {
    ollamaMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    ollamaMessages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }
  return ollamaMessages;
}

// ── Ollama 请求 ─────────────────────────────────────────────────────
function ollamaChat(baseUrl, model, messages, callback) {
  const url = parseUrl(baseUrl + '/api/chat');
  const body = JSON.stringify({ model, messages, stream: false });

  const opts = {
    hostname: url.hostname,
    port: url.port || 11434,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const req = http.request(opts, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        callback(null, json.message?.content || '');
      } catch (e) {
        callback(e);
      }
    });
  });
  req.on('error', callback);
  req.write(body);
  req.end();
}

// ── /v1/messages 处理 (Anthropic 格式) ────────────────────────────
function handleMessages(req, res, body) {
  const config = getConfig();
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'invalid_request', message: '未配置模型，请检查 ~/.claude/.env' } }));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'invalid_request', message: '无效的 JSON' } }));
    return;
  }

  const configModel   = config.OPENAI_MODEL || config.OLLAMA_MODEL || '';
  const model        = mapModel(parsed.model, configModel);
  const maxTokens    = parsed.max_tokens || 4096;
  const temperature  = parsed.temperature;
  const topP         = parsed.top_p;
  const stream       = parsed.stream || false;
  const messages     = parsed.messages || [];
  const systemPrompt = parsed.system || parsed.systemPrompt || ''; // 支持 system 和 systemPrompt

  const baseUrl = config.OPENAI_BASE_URL || config.OLLAMA_BASE_URL || 'http://localhost:11434';

  console.log('\n[POST /v1/messages]  model=' + model + '  base=' + baseUrl + '  system=' + (systemPrompt ? 'yes' : 'no'));

  if (isOllamaUrl(baseUrl)) {
    const ollamaMessages = anthropicToOllama(messages, systemPrompt);
    ollamaChat(baseUrl, model, ollamaMessages, (err, content) => {
      if (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'api_error', message: err.message } }));
        return;
      }
      const response = {
        id: 'msg-' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        model: model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: Math.ceil(content.length / 4) }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  } else {
    // ── OpenAI 兼容后端转发 ────────────────────────────────────────────
    // 构建消息数组：system prompt 放在最前面
    const openaiMessages = [];
    
    // 添加 system 消息（Anthropic 的 system 字段转为 OpenAI 的 system role）
    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }
    
    // 添加用户消息
    for (const msg of messages) {
      // 处理 Anthropic 的 content 格式（可能是字符串或数组）
      let content = msg.content;
      if (Array.isArray(content)) {
        // 提取 text 类型的内容
        content = content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
      }
      openaiMessages.push({ role: msg.role, content: content });
    }

    const forwardUrl = parseUrl(baseUrl + '/chat/completions');
    const apiKey = config.OPENAI_API_KEY || 'test';
    
    // 构建请求体，传递所有支持的参数
    const requestBody = {
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      stream: stream
    };
    
    // 可选参数
    if (temperature !== undefined) requestBody.temperature = temperature;
    if (topP !== undefined) requestBody.top_p = topP;
    
    const postBody = JSON.stringify(requestBody);

    const opts = {
      hostname: forwardUrl.hostname,
      port: forwardUrl.port || 443,
      path: forwardUrl.pathname,
      method: 'POST',
      timeout: 120000, // 2分钟超时
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + apiKey 
      }
    };

    const client = forwardUrl.protocol === 'https:' ? https : http;
    const fwdReq = client.request(opts, fwdRes => {
      console.log('上游响应状态:', fwdRes.statusCode);
      
      // ── 流式响应处理 ─────────────────────────────────────────────
      if (stream) {
        // 先检查状态码
        if (fwdRes.statusCode >= 400) {
          let errorData = '';
          fwdRes.on('data', c => errorData += c);
          fwdRes.on('end', () => {
            console.error('上游错误响应:', fwdRes.statusCode, errorData);
            res.writeHead(fwdRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              type: 'error',
              error: {
                type: 'api_error',
                message: '上游 API 错误: ' + fwdRes.statusCode,
                details: errorData
              }
            }));
          });
          return;
        }
        
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        let buffer = '';
        let messageId = 'msg-' + Date.now();
        
        fwdRes.on('data', chunk => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // 发送 Anthropic 格式的结束事件
                res.write('event: message_stop\n\n');
                continue;
              }
              
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta;
                const finishReason = json.choices?.[0]?.finish_reason;
                
                if (delta?.content) {
                  // 转换为 Anthropic 流式格式
                  const anthropicEvent = {
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'text_delta', text: delta.content }
                  };
                  res.write('event: content_block_delta\n');
                  res.write('data: ' + JSON.stringify(anthropicEvent) + '\n\n');
                }
                
                if (finishReason) {
                  res.write('event: message_delta\n');
                  res.write('data: ' + JSON.stringify({
                    type: 'message_delta',
                    delta: { stop_reason: finishReason === 'stop' ? 'end_turn' : finishReason },
                    usage: { output_tokens: json.usage?.completion_tokens || 0 }
                  }) + '\n\n');
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        });
        
        fwdRes.on('end', () => {
          res.end();
        });
        
        return;
      }
      
      // ── 非流式响应处理 ─────────────────────────────────────────────
      let data = '';
      fwdRes.on('data', c => data += c);
      fwdRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          // 处理 OpenAI API 返回的错误
          if (json.error) {
            res.writeHead(fwdRes.statusCode || 502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: {
                type: 'api_error',
                message: json.error.message || JSON.stringify(json.error)
              }
            }));
            return;
          }
          
          // 提取响应内容
          const choice = json.choices && json.choices[0];
          const message = choice && choice.message;
          const content = message ? (message.content || '') : '';
          
          // 处理 reasoning_content（推理模型的思考内容）
          const reasoningContent = message && message.reasoning_content ? message.reasoning_content : null;
          
          // 构建 Anthropic 格式的响应
          const response = {
            id: 'msg-' + Date.now(),
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: reasoningContent || content }],
            model: model,
            stop_reason: choice ? (choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason) : 'end_turn',
            stop_sequence: null,
            usage: json.usage || { input_tokens: 0, output_tokens: 0 }
          };
          
          // 如果有推理内容，添加到响应中
          if (reasoningContent && content) {
            response.content = [
              { type: 'text', text: content }
            ];
            // 可以在这里添加 reasoning 字段（如果 Claude Code 支持）
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (e) {
          console.error('解析上游响应失败:', e.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: { 
              type: 'api_error', 
              message: '上游响应解析失败: ' + e.message,
              raw: data.substring(0, 500)
            } 
          }));
        }
      });
    });
    
    let responded = false;
    
    fwdReq.on('error', e => {
      if (responded) return;
      responded = true;
      console.error('上游请求失败:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'api_error', message: '上游连接失败: ' + e.message } }));
    });
    
    fwdReq.on('timeout', () => {
      if (responded) return;
      responded = true;
      console.error('上游请求超时');
      fwdReq.destroy();
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'api_error', message: '上游请求超时' } }));
    });
    
    console.log('发送请求到上游:', baseUrl + '/chat/completions', 'model=' + model);
    fwdReq.write(postBody);
    fwdReq.end();
  }
}

// ── /v1/chat/completions 处理 (OpenAI 格式) ────────────────────────
function handleChat(req, res, body) {
  const config = getConfig();
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '未配置模型' }));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '无效的 JSON' }));
    return;
  }

  const configModel = config.OPENAI_MODEL || config.OLLAMA_MODEL || '';
  const model      = mapModel(parsed.model, configModel);
  const messages   = parsed.messages || [];
  const baseUrl = config.OPENAI_BASE_URL || config.OLLAMA_BASE_URL || 'http://localhost:11434';

  console.log('\n[POST /v1/chat/completions]  model=' + model + '  base=' + baseUrl);

  if (isOllamaUrl(baseUrl)) {
    ollamaChat(baseUrl, model, messages, (err, content) => {
      if (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const response = {
        id: 'chat-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 0, completion_tokens: Math.ceil(content.length / 4), total_tokens: 0 }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  } else {
    const forwardUrl = parseUrl(baseUrl + '/chat/completions');
    const apiKey = config.OPENAI_API_KEY || 'test';
    
    // 重新构建请求体，使用映射后的模型名
    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: parsed.max_tokens
    };
    if (parsed.temperature !== undefined) requestBody.temperature = parsed.temperature;
    if (parsed.top_p !== undefined) requestBody.top_p = parsed.top_p;
    
    const postBody = JSON.stringify(requestBody);
    
    const opts = {
      hostname: forwardUrl.hostname,
      port: forwardUrl.port || 443,
      path: forwardUrl.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
    };
    const client = forwardUrl.protocol === 'https:' ? https : http;
    const fwdReq = client.request(opts, fwdRes => {
      let data = '';
      fwdRes.on('data', c => data += c);
      fwdRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(fwdRes.statusCode || 200);
        res.end(data);
      });
    });
    fwdReq.on('error', e => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    fwdReq.write(postBody);
    fwdReq.end();
  }
}

// ── 主服务器 ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // 记录所有请求
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/v1/messages' && req.method === 'GET') {
    // 返回端点信息，表示可用
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'messages_endpoint',
      status: 'available',
      supported_methods: ['POST']
    }));
    return;
  }

  // 支持 query string，如 /v1/messages?beta=true
  if (req.url.startsWith('/v1/messages') && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => handleMessages(req, res, body));
    return;
  }

  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => handleChat(req, res, body));
    return;
  }

  if (req.url === '/v1/models' && req.method === 'GET') {
    const config = getConfig();
    const model = config ? (config.OPENAI_MODEL || config.OLLAMA_MODEL || 'unknown') : 'unknown';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [{ id: model, object: 'model', created: Date.now(), owned_by: 'local' }]
    }));
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    const config = getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      port: PROXY_PORT,
      model: config ? (config.OLLAMA_MODEL || config.OPENAI_MODEL || '未设置') : '未配置'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '仅支持 POST /v1/messages, POST /v1/chat/completions, GET /v1/models, GET /health', path: req.url, method: req.method }));
});

server.listen(PROXY_PORT, HOST, () => {
  const config = getConfig();
  const model = config ? (config.OLLAMA_MODEL || config.OPENAI_MODEL || '未设置') : '未配置';
  console.log('Claude Proxy 启动成功');
  console.log('端口: ' + PROXY_PORT);
  console.log('端点: POST /v1/messages  (Anthropic)');
  console.log('端点: POST /v1/chat/completions  (OpenAI)');
  console.log('端点: GET  /health');
  console.log('当前模型: ' + model);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PROXY_PORT + ' 已被占用');
  } else {
    console.error('服务器错误:', e.message);
  }
  process.exit(1);
});
