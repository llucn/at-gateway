# Webhook 推送

## 概述

系统在收到短信或通话事件时，向配置的 URL 发起 HTTP POST 推送。支持 HMAC-SHA256 签名验证和失败自动重试。Webhook 配置项通过 [settings.md](./settings.md) 管理。

## 推送事件类型

| 事件 | 触发时机 | 配置键 | Content-Type |
|------|---------|--------|-------------|
| `sms.received` | 收到新入站短信 | `webhook.smsUrl` | `application/x-www-form-urlencoded` |
| `call.ended` | 通话结束时 | `webhook.callUrl` | `application/json` |

## 请求规格

### 请求头

| 请求头 | 说明 |
|--------|------|
| `X-Gateway-Signature` | HMAC-SHA256 签名，格式：`sha256=<base64编码的哈希值>` |
| `X-Gateway-Timestamp` | 请求发起时的 Unix 时间戳（秒） |
| `X-Gateway-Event` | 事件类型字符串（如 `sms.received`） |
| `Content-Type` | 见上方事件表 |

### HMAC 签名算法

```
raw_payload = <请求体字符串>
message = timestamp + "." + raw_payload
signature = HMAC-SHA256(webhook.secret, message)
header_value = "sha256=" + base64(signature)
```

接收方应在获取请求体后，用相同算法重新计算并比对签名，同时检查时间戳是否在合理误差范围内（建议 ±5 分钟）防止重放攻击。

## SMS Webhook 请求体

格式：`application/x-www-form-urlencoded`，与 Twilio 入站短信格式兼容。

```
From=%2B8613012345678&To=&Body=%E7%9F%AD%E4%BF%A1%E5%86%85%E5%AE%B9&MessageSid=uuid-of-sms-message
```

| 字段 | 说明 |
|------|------|
| `From` | 发件人号码（E.164 格式，URL 编码） |
| `To` | 收件人（固定为空字符串，表示本机） |
| `Body` | 短信内容（URL 编码） |
| `MessageSid` | 短信记录的 UUID |

> **注意**：此格式在 PR #4 由 JSON 改为 form-urlencoded，以保持与 Twilio 生态的兼容性。若使用 Twilio SDK 或 no-code 工具（如 Zapier）接收 Webhook，可直接兼容。

## Call Webhook 请求体

格式：`application/json`

```json
{
  "id": "uuid",
  "direction": "inbound",
  "phoneNumber": "+8613012345678",
  "status": "ended",
  "duration": 120,
  "startedAt": "2026-10-22T10:00:00.000Z",
  "answeredAt": "2026-10-22T10:00:05.000Z",
  "endedAt": "2026-10-22T10:02:05.000Z"
}
```

## 重试机制

- 推送超时（超过 `webhook.timeoutMs`）或响应状态码非 2xx 时，触发自动重试
- 最大重试次数：由 `webhook.maxAttempts` 配置，默认 3 次
- 重试间隔：指数退避（首次立即，之后按指数增长）
- 所有推送尝试（成功和失败）均记录在 `WebhookDelivery` 表中

## 数据模型：WebhookDelivery

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| eventType | string | 事件类型，如 `sms.received` |
| url | string | 推送目标 URL |
| payload | string | 推送内容（序列化字符串） |
| metadata | object? | 附加信息，如 `{ contentType: "application/x-www-form-urlencoded" }` |
| attempts | integer | 已尝试次数，初始为 0 |
| lastAttemptAt | datetime? | 最后一次尝试时间 |
| nextRetryAt | datetime? | 下次计划重试时间 |
| deliveredAt | datetime? | 成功投递时间（2xx 响应时记录） |
| failureReason | string? | 最后一次失败原因 |
| status | enum | `pending` \| `delivered` \| `failed` |
| createdAt | datetime | 记录创建时间 |

### 枚举：status

| 值 | 说明 |
|----|------|
| `pending` | 等待推送或正在重试 |
| `delivered` | 已成功推送（收到 2xx 响应） |
| `failed` | 已达到最大重试次数，推送失败 |
