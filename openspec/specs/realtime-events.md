# 实时事件（WebSocket）

## 概述

前端通过 Socket.io 连接接收实时推送事件，无需轮询。服务端使用 NestJS WebSocket 网关（`EventsModule`）在内部事件发生时向所有已连接的客户端广播。

## 连接

- 端点：`/events`（经由 Nginx 代理时升级为 WebSocket）
- 库：Socket.io（客户端需使用 socket.io-client）
- 认证：连接时通过 `auth` 选项传递 JWT Access Token

```typescript
import { io } from 'socket.io-client';

const socket = io('/events', {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

连接成功后，服务端验证令牌有效性，令牌过期或无效则断开连接。

## 事件列表

### 调制解调器事件

| 事件名 | 触发时机 | data 结构 |
|--------|---------|----------|
| `modem.connected` | 调制解调器 USB 连接并初始化完成 | `{ port: string }` |
| `modem.disconnected` | 调制解调器断开或串口通信失败 | `{ reason: string }` |
| `modem.error` | 调制解调器发生可恢复或不可恢复错误 | `{ message: string, code?: string }` |
| `modem.status_update` | 定时状态轮询更新（每 10 秒） | ModemStatus 对象（见 [status.md](./status.md)） |

### 短信事件

| 事件名 | 触发时机 | data 结构 |
|--------|---------|----------|
| `sms.received` | 收到新入站短信 | SmsMessage 对象（见 [sms.md](./sms.md)） |
| `sms.sent` | 出站短信成功发送 | `{ id: string, status: "sent", deliveredAt: string }` |
| `sms.failed` | 出站短信发送失败 | `{ id: string, status: "failed", failureReason: string }` |

### 通话事件

| 事件名 | 触发时机 | data 结构 |
|--------|---------|----------|
| `call.incoming` | 收到来电（RING URC） | `{ id: string, phoneNumber: string, startedAt: string }` |
| `call.started` | 外呼发起 | `{ id: string, phoneNumber: string, startedAt: string }` |
| `call.answered` | 通话接通（来电接听或外呼对端接听） | `{ id: string, answeredAt: string }` |
| `call.ended` | 通话正常结束 | `{ id: string, duration: number, endedAt: string }` |
| `call.failed` | 通话失败（拒接、无信号等） | `{ id: string, status: "failed", failureReason: string }` |

## 事件数据外层结构

所有事件的 Socket.io `data` 参数直接为对应对象，不包含额外的外层包装：

```typescript
// 客户端监听示例
socket.on('sms.received', (smsMessage) => {
  console.log(smsMessage.phoneNumber, smsMessage.content);
});

socket.on('modem.status_update', (status) => {
  console.log(status.signalQuality.rssi);
});
```

## 与 Webhook 的区别

| | WebSocket | Webhook |
|-|-----------|---------|
| 目标 | 浏览器前端实时 UI 更新 | 外部服务器后端集成 |
| 认证 | JWT Bearer Token | API Key（HTTP Basic Auth）|
| 触发事件 | 调制解调器、短信、通话全部事件 | 仅 `sms.received` 和 `call.ended` |
| 连接方式 | 长连接（持久化） | 无状态 HTTP POST |
