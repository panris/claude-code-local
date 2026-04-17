import { serve } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir, networkInterfaces } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// 获取 Claude Code 配置目录
function getClaudeConfigDir() {
  return join(homedir(), ".claude");
}

// 获取 settings.json 路径
function getSettingsPath() {
  return join(getClaudeConfigDir(), "settings.json");
}

// 读取配置
function readSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (!existsSync(settingsPath)) {
      return {};
    }
    const content = readFileSync(settingsPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("读取配置失败:", error);
    return {};
  }
}

// 保存配置
function writeSettings(settings) {
  try {
    const configDir = getClaudeConfigDir();
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    const settingsPath = getSettingsPath();
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    return true;
  } catch (error) {
    console.error("保存配置失败:", error);
    return false;
  }
}

// 获取本机 IP
function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// 读取静态文件
function readStaticFile(path) {
  try {
    const filePath = join(__dirname, "public", path);
    return readFileSync(filePath);
  } catch (error) {
    return null;
  }
}

// CORS 头
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 处理请求
async function handleRequest(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  // OPTIONS 请求处理
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // API 路由
  if (pathname === "/api/configs" && method === "GET") {
    const settings = readSettings();
    return Response.json({
      configs: settings.modelConfigs || [],
      activeConfig: settings.activeModelConfig || null,
    }, { headers: corsHeaders });
  }

  if (pathname.startsWith("/api/configs/") && method === "GET") {
    const name = decodeURIComponent(pathname.slice("/api/configs/".length));
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    const config = configs.find((c) => c.name === name);
    
    if (!config) {
      return Response.json({ error: "配置不存在" }, { status: 404, headers: corsHeaders });
    }
    
    return Response.json(config, { headers: corsHeaders });
  }

  if (pathname === "/api/configs" && method === "POST") {
    const body = await req.json();
    const { name, provider, apiKey, baseUrl, model } = body;
    
    if (!name || !provider || !apiKey || !model) {
      return Response.json(
        { error: "缺少必要字段: name, provider, apiKey, model" },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    
    if (configs.some((c) => c.name === name)) {
      return Response.json({ error: "配置名称已存在" }, { status: 409, headers: corsHeaders });
    }
    
    const newConfig = { name, provider, apiKey, model, ...(baseUrl && { baseUrl }) };
    configs.push(newConfig);
    settings.modelConfigs = configs;
    
    if (!settings.activeModelConfig) {
      settings.activeModelConfig = name;
      settings.modelType = provider;
      settings.model = model;
    }
    
    if (writeSettings(settings)) {
      return Response.json(newConfig, { status: 201, headers: corsHeaders });
    } else {
      return Response.json({ error: "保存配置失败" }, { status: 500, headers: corsHeaders });
    }
  }

  if (pathname.startsWith("/api/configs/") && method === "PUT") {
    const oldName = decodeURIComponent(pathname.slice("/api/configs/".length));
    const body = await req.json();
    const { provider, apiKey, baseUrl, model } = body;
    
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    const index = configs.findIndex((c) => c.name === oldName);
    
    if (index === -1) {
      return Response.json({ error: "配置不存在" }, { status: 404, headers: corsHeaders });
    }
    
    configs[index] = {
      ...configs[index],
      ...(provider && { provider }),
      ...(apiKey && { apiKey }),
      ...(model && { model }),
      ...(baseUrl !== undefined && { baseUrl }),
    };
    
    settings.modelConfigs = configs;
    
    if (settings.activeModelConfig === oldName) {
      settings.modelType = configs[index].provider;
      settings.model = configs[index].model;
    }
    
    if (writeSettings(settings)) {
      return Response.json(configs[index], { headers: corsHeaders });
    } else {
      return Response.json({ error: "保存配置失败" }, { status: 500, headers: corsHeaders });
    }
  }

  if (pathname.startsWith("/api/configs/") && method === "DELETE") {
    const name = decodeURIComponent(pathname.slice("/api/configs/".length));
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    const index = configs.findIndex((c) => c.name === name);
    
    if (index === -1) {
      return Response.json({ error: "配置不存在" }, { status: 404, headers: corsHeaders });
    }
    
    configs.splice(index, 1);
    settings.modelConfigs = configs;
    
    if (settings.activeModelConfig === name) {
      settings.activeModelConfig = configs.length > 0 ? configs[0].name : null;
      if (configs.length > 0) {
        settings.modelType = configs[0].provider;
        settings.model = configs[0].model;
      }
    }
    
    if (writeSettings(settings)) {
      return Response.json({ success: true }, { headers: corsHeaders });
    } else {
      return Response.json({ error: "删除配置失败" }, { status: 500, headers: corsHeaders });
    }
  }

  if (pathname.endsWith("/activate") && method === "POST") {
    const name = decodeURIComponent(pathname.slice("/api/configs/".length, -"/activate".length));
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    const config = configs.find((c) => c.name === name);
    
    if (!config) {
      return Response.json({ error: "配置不存在" }, { status: 404, headers: corsHeaders });
    }
    
    settings.activeModelConfig = config.name;
    settings.modelType = config.provider;
    settings.model = config.model;
    
    if (writeSettings(settings)) {
      return Response.json({
        success: true,
        activeConfig: config.name,
        modelType: config.provider,
        model: config.model,
      }, { headers: corsHeaders });
    } else {
      return Response.json({ error: "激活配置失败" }, { status: 500, headers: corsHeaders });
    }
  }

  if (pathname === "/api/active" && method === "GET") {
    const settings = readSettings();
    const configs = settings.modelConfigs || [];
    const active = configs.find((c) => c.name === settings.activeModelConfig);
    
    return Response.json({
      activeConfig: settings.activeModelConfig,
      modelType: settings.modelType,
      model: settings.model,
      config: active || null,
    }, { headers: corsHeaders });
  }

  if (pathname === "/api/settings" && method === "GET") {
    const settings = readSettings();
    return Response.json(settings, { headers: corsHeaders });
  }

  if (pathname === "/api/health" && method === "GET") {
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      configPath: getSettingsPath(),
    }, { headers: corsHeaders });
  }

  // 静态文件
  if (pathname === "/" || pathname === "/index.html") {
    const content = readStaticFile("index.html");
    if (content) {
      return new Response(content, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
      });
    }
  }

  // 404
  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

// 启动服务器
const server = serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
});

console.log(`
╔════════════════════════════════════════════════════════╗
║     Claude Code 模型配置管理服务器                      ║
╠════════════════════════════════════════════════════════╣
║  访问地址:                                             ║
║    - 本机: http://localhost:${PORT}                      ║
║    - 局域网: http://${getLocalIP()}:${PORT}                ║
║    - 所有接口: http://${HOST}:${PORT}                    ║
╠════════════════════════════════════════════════════════╣
║  配置文件路径:                                         ║
║    ${getSettingsPath()}
╚════════════════════════════════════════════════════════╝
`);
