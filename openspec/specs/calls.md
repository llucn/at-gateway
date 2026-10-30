# 通话（Calls）

## 概述

支持拨出和接入语音通话。外呼时可附带 TTS 消息在接通后播放。通话结束后触发 Webhook 推送和 WebSocket 实时事件。

## 数据模型：CallRecord

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| direction | enum | `inbound` \| `outbound` |
| phoneNumber | string | E.164 格式 |
| status | enum | `initiating` \| `ringing` \| `active` \| `ended` \| `failed` \| `missed` |
| startedAt | datetime | 呼叫发起时间 |
| answeredAt | datetime? | 接通时间 |
| endedAt | datetime? | 结束时间 |
| duration | integer? | 通话时长（秒） |
| failureReason | string? | 失败原因 |
| recordingId | UUID? | 关联录音 ID |
| transcription | string? | 语音转文字结果（STT） |
| webhookDelivered | boolean | Webhook 是否已推送 |
| metadata | object? | 扩展元数据 |
| createdAt | datetime | 记录创建时间 |

## 通话状态流转

```
外呼：initiating → ringing → active → ended
                                    ↘ failed

来电：(RING URC) → ringing → active → ended
                                    ↘ missed（未接）
```

## API 端点

### POST /calls

发起外呼。需要 Bearer Token。

**请求体**
```json
{
  "phoneNumber": "+8613012345678",
  "ttsMessage": "可选的 TTS 播报文字",
  "ttsVoice": "可选的 TTS 声音名称"
}
```

**响应**
```json
{ "id": "uuid", "status": "initiating", "timestamp": "ISO8601" }
```

### POST /calls/:id/hangup

挂断指定通话。需要 Bearer Token。

**响应**：204 No Content

### GET /calls

获取通话记录列表（分页）。需要 Bearer Token。

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，从 1 开始，默认 1 |
| limit | integer | 每页条数，默认 20，最大 100 |
| direction | enum | 过滤方向：inbound \| outbound |
| status | enum | 过滤状态 |
| phoneNumber | string | 过滤号码 |
| startDate | ISO8601 | 开始时间起始 |
| endDate | ISO8601 | 开始时间结束 |

**响应**
```json
{
  "data": [ /* CallRecord 数组 */ ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### GET /calls/:id

获取单条通话详情。需要 Bearer Token。

## WebSocket 事件

| 事件名 | 触发时机 |
|--------|---------|
| `call.incoming` | 收到来电 |
| `call.started` | 外呼发起 |
| `call.answered` | 通话接通 |
| `call.ended` | 通话结束 |
| `call.failed` | 通话失败 |

详见 [realtime-events.md](./realtime-events.md)。
