# Claude Code 模型配置管理服务器

通过 Web 界面管理 Claude Code 的多个 AI 模型配置，支持通过 IP+端口或域名访问。

## 功能特性

- 🌐 **Web 管理界面** - 通过浏览器管理模型配置
- 🔧 **多提供商支持** - Anthropic、OpenAI、Gemini、Grok、自定义 API
- ⚡ **实时同步** - 修改后立即写入 ~/.claude/settings.json
- 🔄 **快速切换** - 一键激活不同的模型配置
- 📱 **响应式设计** - 支持桌面和移动设备

## 快速开始

### 1. 安装依赖

```bash
cd /Users/panris/Projects/claude-code/model-config-server
npm install
```

### 2. 启动服务器

```bash
# 方式 1: 使用启动脚本
./start.sh

# 方式 2: 直接启动
node server.js

# 方式 3: 指定端口和主机
PORT=8080 HOST=0.0.0.0 node server.js
```

### 3. 访问页面

启动后会显示访问地址：

```
╔════════════════════════════════════════════════════════╗
║     Claude Code 模型配置管理服务器                      ║
╠════════════════════════════════════════════════════════╣
║  访问地址:                                             ║
║    - 本机: http://localhost:3000                       ║
║    - 局域网: http://192.168.x.x:3000                   ║
║    - 所有接口: http://0.0.0.0:3000                     ║
╠════════════════════════════════════════════════════════╣
║  配置文件路径:                                         ║
║    /Users/panris/.claude/settings.json                 ║
╚════════════════════════════════════════════════════════╝
```

## 部署到生产环境

### 使用 PM2 进程管理器

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name "claude-model-config"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs claude-model-config
```

### 使用 Nginx 反向代理 (域名访问)

```nginx
server {
    listen 80;
    server_name claude-config.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

```bash
# 构建镜像
docker build -t claude-model-config .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v ~/.claude:/root/.claude \
  --name claude-model-config \
  claude-model-config
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/configs` | 获取所有配置 |
| GET | `/api/configs/:name` | 获取单个配置 |
| POST | `/api/configs` | 创建配置 |
| PUT | `/api/configs/:name` | 更新配置 |
| DELETE | `/api/configs/:name` | 删除配置 |
| POST | `/api/configs/:name/activate` | 激活配置 |
| GET | `/api/active` | 获取当前激活配置 |
| GET | `/api/settings` | 获取完整 settings.json |
| GET | `/api/health` | 健康检查 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务器端口 |
| `HOST` | 0.0.0.0 | 监听地址 |

## 数据存储

配置直接读写 Claude Code 的 settings.json 文件：

```
~/.claude/settings.json
```

配置格式：

```json
{
  "modelConfigs": [
    {
      "name": "公司 OpenAI",
      "provider": "openai",
      "apiKey": "sk-...",
      "baseUrl": "https://api.company.com/v1",
      "model": "gpt-4o"
    }
  ],
  "activeModelConfig": "公司 OpenAI",
  "modelType": "openai",
  "model": "gpt-4o"
}
```

## 安全注意事项

⚠️ **重要提示：**

1. **API Key 安全** - 服务器会明文存储 API Key，请确保：
   - 仅在受信任的内网环境部署
   - 使用防火墙限制访问 IP
   - 配置 HTTPS (生产环境)

2. **访问控制** - 建议：
   - 使用 VPN 或内网访问
   - 配置 Nginx Basic Auth
   - 添加 IP 白名单

3. **备份配置** - 定期备份 ~/.claude/settings.json

## 故障排查

### 端口被占用

```bash
# 查找占用 3000 端口的进程
lsof -i :3000

# 使用其他端口启动
PORT=8080 ./start.sh
```

### 权限问题

```bash
# 确保有权限读写 ~/.claude 目录
ls -la ~/.claude

# 如需修复权限
chmod 755 ~/.claude
chmod 644 ~/.claude/settings.json
```

### 跨域问题

服务器已内置 CORS 支持，如需限制访问来源，修改 server.js：

```javascript
app.use(cors({
  origin: ['https://yourdomain.com'] // 只允许特定域名
}));
```

## 许可证

MIT
