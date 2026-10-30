---
id: "001"
title: 初始项目建立
status: released
date: "2026-10-21"
commit: 91f59fb
pr: null
---

# 初始项目建立

## 摘要

建立 AT Gateway monorepo 项目，实现完整的 4G LTE USB 调制解调器语音和短信网关核心功能，共 12940+ 行代码，涵盖后端、前端、AT 引擎、媒体层和部署配置。

## 包含内容

### 后端（apps/api）
- NestJS 应用骨架，含 11+ 模块
- JWT 双令牌认证（AuthModule）：登录、刷新令牌、改密、登出
- 短信收发（SmsModule）：PDU 模式，GSM-7 / UCS-2 自动编码
- 语音通话（CallsModule）：拨出、接入、挂断，支持 TTS 播报
- 录音框架（RecordingsModule）
- Webhook 推送（WebhooksModule）：HMAC-SHA256 签名、自动重试
- 系统设置（SettingsModule）：键值持久化
- 调制解调器状态（StatusModule）：每 10 秒轮询
- 实时事件（EventsModule）：Socket.io WebSocket 网关
- 健康检查（HealthModule）
- TypeORM 实体：User、SmsMessage、CallRecord、Recording、WebhookDelivery、Setting、ModemEvent

### 共享包（packages/shared）
- 全量 TypeScript 类型定义（modem、sms、calls、auth、settings、events）
- 共享常量（分页、信号、音频、Webhook 头）

### AT 引擎（packages/at-modem）
- SerialTransport：串口通信层
- AtClient：AT 命令队列、URC 处理、超时管理
- SmsManager：PDU 编解码、GSM-7 / UCS-2 编解码
- CallManager：通话状态机管理
- StatusManager：设备信息、信号质量、网络状态查询
- USB 端口自动检测（VID/PID 过滤）

### 媒体层（packages/media）
- TTS 提供商框架：Piper、Edge TTS、Azure、OpenAI
- STT 提供商框架：Whisper.cpp、Faster-Whisper、Azure、OpenAI

### 前端（apps/web）
- React 19 SPA，6 个功能页面：Login、Dashboard、SMS、Calls、Recordings、Settings
- Zustand 认证状态管理（localStorage 持久化）
- TanStack Query 服务端状态管理
- Socket.io 实时事件接收

### 部署
- Docker Compose（MariaDB 11.6 + API + Web/Nginx）
- systemd 服务文件（at-gateway-api.service）
- Nginx 配置（WebSocket 代理、SSL/TLS）

## 影响的 Spec

- `specs/auth.md`（新建）
- `specs/sms.md`（新建）
- `specs/calls.md`（新建）
- `specs/recordings.md`（新建）
- `specs/settings.md`（新建）
- `specs/status.md`（新建）
- `specs/webhooks.md`（新建）
- `specs/realtime-events.md`（新建）
- `specs/data-models.md`（新建）
