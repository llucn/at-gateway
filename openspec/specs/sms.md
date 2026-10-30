# 短信（SMS）

## 概述

支持通过 4G 调制解调器发送和接收短信。收到短信时触发 Webhook 推送和 WebSocket 实时事件。

## 数据模型：SmsMessage

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| direction | enum | `inbound` \| `outbound` |
| phoneNumber | string | E.164 格式，如 +8613012345678 |
| content | string | 短信内容，最长 1600 字符 |
| status | enum | `pending` \| `sent` \| `failed` \| `received` |
| encoding | enum | `gsm7` \| `ucs2` \| `binary` |
| deliveredAt | datetime? | 投递成功时间 |
| failureReason | string? | 失败原因 |
| webhookDelivered | boolean | Webhook 是否已推送 |
| metadata | object? | 扩展元数据（PDU 原始数据等） |
| createdAt | datetime | 创建时间 |

## 编码规则

- 纯 ASCII 及 GSM-7 字符集：使用 GSM-7 编码（7 位位压缩），单条最多 160 字符
- 含中文或非 GSM-7 字符：自动切换 UCS-2 大端序编码，单条最多 70 字符
- 超长短信：自动拆分为多条 PDU（级联短信）
- 国际号码（+ 前缀）在 PDU 中以 Type-of-Address=145 处理

## API 端点

### POST /sms

发送短信。需要 Bearer Token。

**请求体**
```json
{ "phoneNumber": "+8613012345678", "content": "消息内容" }
```

**响应**
```json
{ "id": "uuid", "status": "pending", "timestamp": "ISO8601" }
```

### GET /sms

获取短信列表（分页）。需要 Bearer Token。

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，从 1 开始，默认 1 |
| limit | integer | 每页条数，默认 20，最大 100 |
| direction | enum | 过滤方向：inbound \| outbound |
| status | enum | 过滤状态 |
| phoneNumber | string | 过滤号码 |
| startDate | ISO8601 | 创建时间起始 |
| endDate | ISO8601 | 创建时间结束 |

**响应**
```json
{
  "data": [ /* SmsMessage 数组 */ ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### GET /sms/:id

获取单条短信详情。需要 Bearer Token。

## Twilio 兼容端点

第三方系统可通过 API Key Basic Auth 访问 Twilio 兼容接口发送短信，详见 [credentials.md](./credentials.md)。

## WebSocket 事件

| 事件名 | 触发时机 |
|--------|---------|
| `sms.received` | 收到新短信，data 包含完整 SmsMessage |
| `sms.sent` | 短信发送成功 |
| `sms.failed` | 短信发送失败 |

详见 [realtime-events.md](./realtime-events.md)。
