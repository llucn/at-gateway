# AT Gateway

A full-stack Voice & SMS gateway for 4G LTE USB dongles (SIMCom A7670C and compatible devices).

**中文** | [English](#english-documentation)

## 功能特性

### 核心功能
- **短信收发**：完整的 SMS 收发功能，支持 GSM7 和 UCS-2 编码，PDU 模式
- **语音通话**：拨打和接听电话，支持 TTS 语音播放和 STT 转录
- **Webhook 通知**：实时推送 SMS 和通话事件到外部服务
- **录音管理**：自动录制通话音频并转录
- **实时监控**：WebSocket 实时推送设备状态、信号强度、网络注册状态
- **REST API**：完整的 RESTful API，支持 JWT 认证
- **Web 管理界面**：现代化的 React 单页应用，支持深色模式

### 技术架构
- **Monorepo**：pnpm workspace，TypeScript 全栈
- **后端**：NestJS + TypeORM + MySQL + EventEmitter
- **前端**：React 19 + Vite + TailwindCSS + TanStack Query + Zustand
- **AT 引擎**：自研 AT 命令队列、URC 处理、PDU 编解码、串口自动检测
- **媒体处理**：可插拔的 TTS/STT 提供商（Piper、Edge TTS、Whisper.cpp 等）
- **部署**：Docker Compose 一键部署

## 快速开始

### 前置要求
- Node.js 22+ (推荐使用 nvm)
- pnpm 11.5.0+
- MySQL/MariaDB 8.0+
- 支持的 USB 调制解调器（SIMCom A7670C 或兼容设备）

### 本地开发

1. **克隆并安装依赖**
```bash
git clone https://github.com/llucn/at-gateway.git
cd at-gateway
corepack enable
pnpm install
```

2. **配置数据库**
```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE at_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'atgw'@'localhost' IDENTIFIED BY 'atgw';
GRANT ALL PRIVILEGES ON at_gateway.* TO 'atgw'@'localhost';
FLUSH PRIVILEGES;
```

3. **环境变量配置**
```bash
cp apps/api/.env.example apps/api/.env
# 编辑 .env 文件，设置数据库连接、JWT 密钥等
```

关键配置项：
```ini
# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=atgw
DB_PASSWORD=atgw
DB_NAME=at_gateway

# JWT（生产环境必须修改）
JWT_SECRET=your-secret-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-also-32ch

# 管理员账户
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe123!

# 调制解调器（留空自动检测）
MODEM_AUTO_DETECT=true
MODEM_PORT=

# TTS/STT
TTS_PROVIDER=piper
STT_PROVIDER=whisper-cpp
```

4. **运行数据库迁移和种子**
```bash
cd apps/api
pnpm migration:run
pnpm seed
```

5. **启动开发服务器**
```bash
# 终端 1 - 构建共享包（watch 模式）
pnpm --filter "@at-gateway/shared" dev
pnpm --filter "@at-gateway/at-modem" dev
pnpm --filter "@at-gateway/media" dev

# 终端 2 - API 服务器
pnpm --filter "@at-gateway/api" dev

# 终端 3 - Web 前端
pnpm --filter "@at-gateway/web" dev
```

6. **访问应用**
- Web 界面: http://localhost:5173
- API 文档: http://localhost:3000/docs
- 默认登录: `admin` / `ChangeMe123!`

### Docker 部署（推荐生产环境）

1. **准备环境变量**
```bash
cp .env.example .env
# 编辑 .env，设置密钥和配置
```

2. **USB 设备权限**
```bash
# 查找调制解调器设备
lsusb | grep -i simcom
ls -la /dev/ttyUSB*

# 添加当前用户到 dialout 组
sudo usermod -a -G dialout $USER
newgrp dialout

# 或直接在 docker-compose.yml 中添加设备映射：
# devices:
#   - /dev/ttyUSB2:/dev/ttyUSB2
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **查看日志**
```bash
docker-compose logs -f api
docker-compose logs -f web
```

5. **访问应用**
- Web 界面: http://localhost:8080
- API: http://localhost:3000/api

## 项目结构

```
at-gateway/
├── apps/
│   ├── api/                    # NestJS 后端
│   │   ├── src/
│   │   │   ├── config/        # 环境验证、TypeORM 配置
│   │   │   ├── entities/      # TypeORM 实体（User, SMS, Call, etc.）
│   │   │   ├── modules/       # 功能模块
│   │   │   │   ├── auth/      # JWT 认证
│   │   │   │   ├── modem/     # 调制解调器服务
│   │   │   │   ├── sms/       # 短信收发
│   │   │   │   ├── calls/     # 通话管理
│   │   │   │   ├── status/    # 状态轮询
│   │   │   │   ├── webhooks/  # Webhook 投递
│   │   │   │   ├── media/     # TTS/STT
│   │   │   │   ├── events/    # WebSocket 网关
│   │   │   │   └── ...
│   │   │   ├── database/      # 种子脚本、迁移
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── package.json
│   └── web/                    # React 前端
│       ├── src/
│       │   ├── api/           # API 客户端
│       │   ├── components/    # 通用组件
│       │   ├── lib/           # Zustand store
│       │   ├── pages/         # 页面组件
│       │   ├── styles/        # Tailwind CSS
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── package.json
├── packages/
│   ├── shared/                 # 共享类型和常量
│   │   └── src/types/         # TypeScript 类型定义
│   ├── at-modem/              # AT 命令引擎
│   │   ├── src/
│   │   │   ├── transport/     # 串口传输层
│   │   │   ├── core/          # AT 命令队列、解析
│   │   │   ├── codec/         # GSM7/UCS2/PDU 编解码
│   │   │   ├── features/      # SMS、Call、Status 管理器
│   │   │   └── discovery/     # 端口自动检测
│   │   └── package.json
│   └── media/                  # TTS/STT 抽象层
│       ├── src/
│       │   ├── tts/           # TTS 提供商
│       │   └── stt/           # STT 提供商
│       └── package.json
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx.conf
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/refresh` - 刷新令牌
- `POST /api/auth/change-password` - 修改密码

### 状态
- `GET /api/status` - 获取调制解调器状态

### 短信
- `POST /api/sms` - 发送短信
- `GET /api/sms` - 短信列表（分页、筛选）
- `GET /api/sms/:id` - 短信详情

### 通话
- `POST /api/calls` - 拨打电话
- `POST /api/calls/:id/hangup` - 挂断
- `GET /api/calls` - 通话记录
- `GET /api/calls/:id` - 通话详情

### 录音
- `GET /api/recordings` - 录音列表
- `GET /api/recordings/:id` - 录音详情

### 设置
- `GET /api/settings` - 获取所有设置
- `PUT /api/settings` - 更新设置

详细 API 文档：启动开发服务器后访问 http://localhost:3000/docs

## Webhook 事件

### SMS 接收事件
```json
POST {webhook.smsUrl}
Headers:
  X-Gateway-Signature: sha256=...
  X-Gateway-Timestamp: 1234567890
  X-Gateway-Event: sms.received

Body:
{
  "id": "uuid",
  "direction": "inbound",
  "phoneNumber": "+8613800138000",
  "content": "Hello",
  "status": "received",
  "encoding": "gsm7",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### 通话事件
```json
POST {webhook.callUrl}
Headers:
  X-Gateway-Signature: sha256=...
  X-Gateway-Event: call.incoming / call.ended

Body:
{
  "id": "uuid",
  "direction": "inbound",
  "phoneNumber": "+8613800138000",
  "status": "ringing",
  "startedAt": "2025-01-01T00:00:00.000Z"
}
```

### 签名验证
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret, timestamp) {
  const data = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `sha256=${hmac}` === signature;
}
```

## 硬件支持

### 已测试设备
- SIMCom A7670C 4G LTE USB Dongle
- SIMCom A7600C1 (兼容)

### USB 接口说明
A7670C 通过 USB 暴露多个虚拟串口（CDC ACM）：
- **ttyUSB0 / COM3**: 诊断端口
- **ttyUSB1 / COM4**: NMEA/GPS
- **ttyUSB2 / COM5**: AT 命令端口（主）
- **ttyUSB3 / COM6**: AT 命令端口（次）或音频

系统会自动检测正确的 AT 端口（通常是 ttyUSB2）。

### 音频（实验性）
A7670C 支持通过 USB 传输音频（PCM over USB）：
```bash
# 启用音频接口
AT+CPCMREG=1
```
需要配置 ALSA/PulseAudio 捕获音频流。

## 高级配置

### TTS 提供商

#### Piper（推荐，离线）
```bash
# 安装 Piper TTS
pip install piper-tts

# 下载中文模型
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/...

# 配置
TTS_PROVIDER=piper
TTS_PIPER_BIN=piper
TTS_PIPER_MODEL=/path/to/model.onnx
```

#### Edge TTS（免费，在线）
```bash
pip install edge-tts
TTS_PROVIDER=edge
TTS_VOICE=zh-CN-XiaoxiaoNeural
```

### STT 提供商

#### Whisper.cpp（推荐，离线）
```bash
# 编译 whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make

# 下载模型
bash ./models/download-ggml-model.sh small

# 配置
STT_PROVIDER=whisper-cpp
STT_WHISPER_BIN=/path/to/whisper.cpp/main
STT_WHISPER_MODEL=/path/to/models/ggml-small.bin
STT_LANGUAGE=zh
```

#### Faster-Whisper（更快，离线）
```bash
pip install faster-whisper
STT_PROVIDER=faster-whisper
```

### 生产环境优化

1. **反向代理（Nginx/Caddy）**
```nginx
server {
    listen 443 ssl http2;
    server_name gateway.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3000;
        # ... 同上
    }

    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

2. **日志和监控**
- 使用 PM2 或 systemd 管理 Node.js 进程
- 集成 Prometheus + Grafana 监控
- 配置日志轮转（logrotate）

3. **备份策略**
```bash
# 数据库备份
mysqldump -u atgw -p at_gateway > backup.sql

# 录音文件备份
rsync -av ./storage/recordings /backup/
```

## 常见问题

### 调制解调器无法连接
1. 检查 USB 连接和驱动：`lsusb`、`dmesg | grep tty`
2. 检查权限：`ls -la /dev/ttyUSB*`，确保用户在 `dialout` 组
3. 手动指定端口：`MODEM_PORT=/dev/ttyUSB2`
4. 查看日志：`docker-compose logs -f api`

### SIM 卡未就绪
1. 检查 SIM 卡是否插入
2. 如需 PIN 码，设置 `MODEM_SIM_PIN=1234`
3. 查看状态：访问 Web 界面的仪表盘

### 短信发送失败
1. 检查信号强度（RSSI > -100 dBm）
2. 检查网络注册状态（应为"已注册"）
3. 确认 SMSC 号码：`MODEM_SMSC=+8613800100500`（中国移动）
4. 查看错误日志

### Webhook 未收到事件
1. 检查 Webhook URL 配置
2. 查看 `webhook_deliveries` 表
3. 验证签名计算是否正确
4. 确保目标服务器可达（防火墙、网络）

## 开发路线图

- [ ] 支持更多调制解调器型号（Quectel EC20/EC25、华为等）
- [ ] 多 SIM 卡并发管理
- [ ] 完整的音频录制和实时流传输
- [ ] USSD 支持
- [ ] 短信群发和定时发送
- [ ] 通话 IVR（交互式语音应答）
- [ ] 更多 TTS/STT 集成（Azure、OpenAI、本地模型）
- [ ] 移动端 APP（React Native）
- [ ] Kubernetes Helm Chart
- [ ] 集群部署和负载均衡

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

---

## English Documentation

# AT Gateway - Voice & SMS Gateway for 4G LTE Dongles

A production-ready, full-stack voice and SMS gateway built for 4G LTE USB dongles, specifically designed for SIMCom A7670C and compatible devices.

## Features

- **SMS Send/Receive**: Full SMS functionality with GSM7/UCS-2 encoding, PDU mode
- **Voice Calls**: Make and receive calls with TTS playback and STT transcription
- **Webhook Notifications**: Real-time event delivery to external services
- **Recording Management**: Automatic call recording and transcription
- **Real-time Monitoring**: WebSocket-based live updates for device status, signal strength, network registration
- **REST API**: Complete RESTful API with JWT authentication
- **Web Dashboard**: Modern React SPA with dark mode support

## Tech Stack

- **Backend**: NestJS + TypeORM + MySQL + EventEmitter
- **Frontend**: React 19 + Vite + TailwindCSS + TanStack Query + Zustand
- **AT Engine**: Custom AT command queue, URC handling, PDU codec, auto port detection
- **Media**: Pluggable TTS/STT providers (Piper, Edge TTS, Whisper.cpp, etc.)
- **Deployment**: Docker Compose

## Quick Start

See Chinese documentation above for detailed setup instructions.

### Development

```bash
git clone https://github.com/llucn/at-gateway.git
cd at-gateway
corepack enable
pnpm install

# Setup database, configure .env, run migrations
cd apps/api && pnpm migration:run && pnpm seed

# Start dev servers (3 terminals)
pnpm --filter "@at-gateway/shared" dev
pnpm --filter "@at-gateway/api" dev
pnpm --filter "@at-gateway/web" dev
```

### Docker Deployment

```bash
cp .env.example .env
# Edit .env with your configuration
docker-compose up -d
```

Access at http://localhost:8080 (default login: admin / ChangeMe123!)

## License

MIT
