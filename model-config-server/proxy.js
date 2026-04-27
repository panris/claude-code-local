'use strict';
/**
 * Claude Proxy — Anthropic/OpenAI 兼容 API 代理
 *
 * 监听端口: 12655
 * 配置: ~/.claude/.env
 *
 * 支持端点:
 *   POST /v1/messages          (Anthropic 格式)
 *   POST /v1/chat/completions  (OpenAI 格式)
 *   GET  /v1/models
 *   GET  /health
 *   POST /reload               (热重载配置)
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

// ── 配置 ──────────────────────────────────────────────────────────────
const PROXY_PORT = 12655;
const HOST       = '0.0.0.0';

// ── 读取 .env ─────────────────────────────────────────────────────────
function getConfig() {
  try {
    const envPath = path.join(os.homedir(), '.claude', '.env');
    if (!fs.existsSync(envPath)) return null;
    const config = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      config[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return config;
  } catch (e) { return null; }
}

// ── 工具 ───────────────────────────────────────────────────────────────
function parseUrl(urlStr) {
  try { return new URL(urlStr); } catch { return null; }
}

function isOllamaUrl(url) {
  return url && (url.includes('localhost:11434') || url.includes('127.0.0.1:11434'));
}

// ── 日志 ───────────────────────────────────────────────────────────────
const LOG_FILE = path.join(os.homedir(), '.claude', 'proxy-transcript.log');

function log(msg, raw = false) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const line = `[${ts}] ${msg}`;
  if (!raw) console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function logRaw(msg) {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const line = `[${ts}] ${msg}`;
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// ── 模型名映射 ────────────────────────────────────────────────────────
// Claude Code 用 claude-* 前缀，实际发请求时替换为配置的模型名
function mapModel(requestedModel, configModel) {
  if (requestedModel && requestedModel.startsWith('claude-')) {
    return configModel || requestedModel;
  }
  return requestedModel || configModel;
}

// ── Anthropic → Ollama 格式 ──────────────────────────────────────────
function anthropicToOllama(messages, systemPrompt) {
  const ollamaMessages = [];
  if (systemPrompt) ollamaMessages.push({ role: 'system', content: systemPrompt });
  for (const msg of messages) {
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
    ollamaMessages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content });
  }
  return ollamaMessages;
}

// ── Ollama 请求 ───────────────────────────────────────────────────────
function ollamaChat(baseUrl, model, messages, callback) {
  const url = parseUrl(baseUrl + '/api/chat');
  if (!url) return callback(new Error('无效的 Ollama URL'));

  const body = JSON.stringify({ model, messages, stream: false });
  const opts = {
    hostname: url.hostname,
    port:     url.port || 11434,
    path:     '/api/chat',
    method:   'POST',
    headers:  { 'Content-Type': 'application/json' }
  };

  const req = http.request(opts, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        callback(null, json.message?.content || '');
      } catch (e) { callback(e); }
    });
  });
  req.on('error', callback);
  req.write(body);
  req.end();
}

// ── 构建 baseUrl（避免重复 /chat/completions）────────────────────────
function buildForwardUrl(baseUrl) {
  const clean = baseUrl.replace(/\/chat\/completions\/?$/, '');
  return clean + '/chat/completions';
}

// ── /v1/messages 处理（Anthropic 格式）────────────────────────────────
function handleMessages(req, res, body) {
  const config = getConfig();
  if (!config) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'api_error', message: '未配置模型，请在配置页面添加模型' } }));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'invalid_request_error', message: '无效的 JSON 请求体' } }));
    return;
  }

  const configModel = config.CLAUDE_MODEL || config.OPENAI_MODEL || config.OLLAMA_MODEL || '';
  const model       = mapModel(parsed.model, configModel);
  const maxTokens   = parsed.max_tokens || 8192;
  const temperature = parsed.temperature;
  const topP        = parsed.top_p;
  const stream      = parsed.stream || false;
  const messages    = parsed.messages || [];
  const systemPrompt = parsed.system || parsed.systemPrompt || '';
  const baseUrl     = config.OPENAI_BASE_URL_FULL || config.OPENAI_BASE_URL || config.OLLAMA_BASE_URL || 'http://localhost:11434';

  // ── 日志：记录本次请求 ───────────────────────────────────────────────
  log(`\n========== 新请求 ==========`);
  log(`模型: ${parsed.model || '(未指定)'} → 映射: ${model || configModel || '(未配置)'}`);
  log(`baseUrl: ${baseUrl}`);
  log(`stream: ${stream}`);
  // 打印用户消息（取最后一条 user 消息）
  const userMsgs = messages.filter(m => m.role === 'user');
  if (userMsgs.length) {
    const last = userMsgs[userMsgs.length - 1];
    let content = Array.isArray(last.content)
      ? last.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
      : (last.content || '');
    content = stripAnsi(content).slice(0, 300);
    log(`用户: ${content}${content.length >= 300 ? '...' : ''}`);
  }
  log('');

  // 读取 baseUrl（优先用 OPENAI_BASE_URL_FULL，再用 OPENAI_BASE_URL）
  // baseUrl 已在函数顶部声明，这里直接使用

  if (isOllamaUrl(baseUrl)) {
    // ── Ollama ───────────────────────────────────────────────────────
    const ollamaMessages = anthropicToOllama(messages, systemPrompt);
    ollamaChat(baseUrl, model, ollamaMessages, (err, content) => {
      if (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'api_error', message: 'Ollama 连接失败: ' + err.message } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg-' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: Math.ceil(content.length / 4) }
      }));
    });
    return;
  }

  // ── OpenAI 兼容后端 ───────────────────────────────────────────────
  // 构建消息：system 放在最前面
  const openaiMessages = [];
  if (systemPrompt) openaiMessages.push({ role: 'system', content: systemPrompt });
  for (const msg of messages) {
    let content = msg.content;
    if (Array.isArray(content)) {
      content = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
    openaiMessages.push({ role: msg.role, content });
  }

  const forwardUrl = parseUrl(buildForwardUrl(baseUrl));
  if (!forwardUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'api_error', message: '无效的 baseUrl: ' + baseUrl } }));
    return;
  }

  const apiKey = config.OPENAI_API_KEY || 'test';
  const requestBody = { model, messages: openaiMessages, max_tokens: maxTokens, stream };
  if (temperature !== undefined) requestBody.temperature = temperature;
  if (topP !== undefined) requestBody.top_p = topP;

  const opts = {
    hostname: forwardUrl.hostname,
    port:     forwardUrl.port || 443,
    path:     forwardUrl.pathname + forwardUrl.search,
    method:   'POST',
    timeout:  120000,
    headers:  { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
  };

  const client = forwardUrl.protocol === 'https:' ? https : http;
  const fwdReq = client.request(opts, fwdRes => {

    // ── 流式响应 ───────────────────────────────────────────────
    if (stream) {
      if (fwdRes.statusCode >= 400) {
        let errorData = '';
        fwdRes.on('data', c => errorData += c);
        fwdRes.on('end', () => {
          res.writeHead(fwdRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: '上游 API 错误: ' + fwdRes.statusCode } }));
        });
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

      let buffer = '';
      fwdRes.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') { res.write('event: message_stop\n\n'); continue; }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;

            if (delta?.content) {
              process.stdout.write(stripAnsi(delta.content));
              logRaw('MODEL| ' + delta.content);
              res.write('event: content_block_delta\n');
              res.write('data: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } }) + '\n\n');
            }
            if (finishReason) {
              res.write('event: message_delta\n');
              res.write('data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: finishReason === 'stop' ? 'end_turn' : finishReason }, usage: { output_tokens: json.usage?.completion_tokens || 0 } }) + '\n\n');
            }
          } catch (_) { /* 忽略解析错误 */ }
        }
      });

      fwdRes.on('end', () => res.end());
      return;
    }

    // ── 非流式响应 ──────────────────────────────────────────────
    let data = '';
    fwdRes.on('data', c => data += c);
    fwdRes.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.error) {
          res.writeHead(fwdRes.statusCode || 502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { type: 'api_error', message: json.error.message || JSON.stringify(json.error) } }));
          return;
        }

        const choice   = json.choices?.[0];
        const message  = choice?.message;
        const content   = message?.content || '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg-' + Date.now(),
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: content }],
          model,
          stop_reason: choice ? (choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason) : 'end_turn',
          stop_sequence: null,
          usage: json.usage || { input_tokens: 0, output_tokens: 0 }
        }));
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'api_error', message: '上游响应解析失败' } }));
      }
    });
  });

  let responded = false;
  fwdReq.on('error', e => {
    if (responded) return;
    responded = true;
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'api_error', message: '上游连接失败: ' + e.message } }));
  });
  fwdReq.on('timeout', () => {
    if (responded) return;
    responded = true;
    fwdReq.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { type: 'api_error', message: '上游请求超时（2分钟）' } }));
  });

  fwdReq.write(JSON.stringify(requestBody));
  fwdReq.end();
}

// ── /v1/chat/completions 处理（OpenAI 格式）───────────────────────────
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

  const configModel = config.CLAUDE_MODEL || config.OPENAI_MODEL || config.OLLAMA_MODEL || '';
  const model       = mapModel(parsed.model, configModel);
  const messages    = parsed.messages || [];
  let baseUrl       = config.OPENAI_BASE_URL_FULL || config.OPENAI_BASE_URL || config.OLLAMA_BASE_URL || 'http://localhost:11434';

  if (isOllamaUrl(baseUrl)) {
    ollamaChat(baseUrl, model, messages, (err, content) => {
      if (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'chat-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: Math.ceil(content.length / 4), total_tokens: 0 }
      }));
    });
    return;
  }

  const forwardUrl = parseUrl(buildForwardUrl(baseUrl));
  if (!forwardUrl) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '无效的 baseUrl' }));
    return;
  }

  const apiKey = config.OPENAI_API_KEY || 'test';
  const requestBody = { model, messages };
  if (parsed.max_tokens !== undefined) requestBody.max_tokens = parsed.max_tokens;
  if (parsed.temperature !== undefined) requestBody.temperature = parsed.temperature;
  if (parsed.top_p !== undefined) requestBody.top_p = parsed.top_p;

  const opts = {
    hostname: forwardUrl.hostname,
    port:     forwardUrl.port || 443,
    path:     forwardUrl.pathname + forwardUrl.search,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
  };

  const client = forwardUrl.protocol === 'https:' ? https : http;
  const fwdReq = client.request(opts, fwdRes => {
    let data = '';
    fwdRes.on('data', c => data += c);
    fwdRes.on('end', () => {
      res.writeHead(fwdRes.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  });
  fwdReq.on('error', e => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  fwdReq.write(JSON.stringify(requestBody));
  fwdReq.end();
}

// ── 主服务器 ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // 去掉 query string
  const pathname = (req.url || '/').split('?')[0];

  // GET /health
  if (pathname === '/health' && req.method === 'GET') {
    const config = getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      port:   PROXY_PORT,
      model:  config ? (config.CLAUDE_MODEL || config.OPENAI_MODEL || '未设置') : '未配置'
    }));
    return;
  }

  // POST /reload — 热重载配置（后端通知用）
  if (pathname === '/reload' && req.method === 'POST') {
    const config = getConfig();
    const model = config ? (config.CLAUDE_MODEL || config.OPENAI_MODEL || '未设置') : '未配置';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', model, reloaded: true }));
    return;
  }

  // GET /v1/models
  if (pathname === '/v1/models' && req.method === 'GET') {
    const config = getConfig();
    const model  = config ? (config.CLAUDE_MODEL || config.OPENAI_MODEL || 'unknown') : 'unknown';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: [{ id: model, object: 'model', created: Date.now(), owned_by: 'local' }] }));
    return;
  }

  // POST /v1/messages (Anthropic)
  if (pathname === '/v1/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => handleMessages(req, res, body));
    return;
  }

  // POST /v1/chat/completions (OpenAI)
  if (pathname === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => handleChat(req, res, body));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: '仅支持 POST /v1/messages, POST /v1/chat/completions, GET /v1/models, GET /health', path: pathname }));
});

server.listen(PROXY_PORT, HOST, () => {
  const config = getConfig();
  const model  = config ? (config.CLAUDE_MODEL || config.OPENAI_MODEL || '未设置') : '未配置';
  console.log('\u2705 Claude Proxy 启动成功');
  console.log('   端口: ' + PROXY_PORT);
  console.log('   当前模型: ' + model);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\u274C 端口 ' + PROXY_PORT + ' 已被占用，请先关闭旧进程');
  } else {
    console.error('\u274C 服务器错误:', e.message);
  }
  process.exit(1);
});
