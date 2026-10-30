# 系统设置（Settings）

## 概述

系统设置以键值对形式持久化存储在数据库中，支持批量读写。涵盖 Webhook、调制解调器、TTS、STT 四个配置域。所有值在数据库层面均以字符串存储，客户端负责类型转换。

## 数据模型：Setting

| 字段 | 类型 | 说明 |
|------|------|------|
| key | string | 设置键，唯一，格式为 `domain.name` |
| value | string | 设置值（字符串存储） |
| updatedAt | datetime | 最后更新时间 |

## 设置键列表

### Webhook 设置

| 键 | 值类型 | 默认值 | 说明 |
|----|--------|--------|------|
| `webhook.smsUrl` | string | 空 | 收到短信时推送的目标 URL |
| `webhook.callUrl` | string | 空 | 通话事件推送的目标 URL |
| `webhook.secret` | string | 空 | HMAC 签名密钥 |
| `webhook.timeoutMs` | number | `5000` | 推送请求超时（毫秒） |
| `webhook.maxAttempts` | number | `3` | 最大重试次数 |
| `webhook.enabled` | boolean | `false` | 是否启用 Webhook 推送 |

### 调制解调器设置

| 键 | 值类型 | 默认值 | 说明 |
|----|--------|--------|------|
| `modem.port` | string | 空 | 串口路径，如 `/dev/ttyUSB2`，空则自动检测 |
| `modem.baudRate` | number | `115200` | 串口波特率 |
| `modem.autoDetect` | boolean | `true` | 是否自动检测 USB 端口 |
| `modem.audioMode` | enum | `none` | 音频模式：`usb` \| `none` |

### TTS 设置

| 键 | 值类型 | 默认值 | 说明 |
|----|--------|--------|------|
| `tts.provider` | enum | `none` | 提供商：`piper` \| `edge` \| `azure` \| `openai` \| `none` |
| `tts.voice` | string | 空 | TTS 声音名称（取决于提供商） |
| `tts.apiKey` | string | 空 | 第三方 TTS 服务 API Key |

### STT 设置

| 键 | 值类型 | 默认值 | 说明 |
|----|--------|--------|------|
| `stt.provider` | enum | `none` | 提供商：`whisper-cpp` \| `faster-whisper` \| `azure` \| `openai` \| `none` |
| `stt.language` | string | `zh` | 识别语言代码（BCP-47） |
| `stt.apiKey` | string | 空 | 第三方 STT 服务 API Key |

## API 端点

### GET /settings

获取所有设置键值对。需要 Bearer Token。

**响应**
```json
{
  "webhook.smsUrl": "https://example.com/sms",
  "webhook.enabled": "true",
  "modem.autoDetect": "true",
  "tts.provider": "piper"
}
```

> 所有值均以字符串类型返回，布尔值为 `"true"` / `"false"`，数字为数字字符串。

### PUT /settings

批量更新设置。需要 Bearer Token。仅传入需要修改的键，未传入的键保持原值。

**请求体**
```json
{
  "webhook.smsUrl": "https://example.com/sms",
  "webhook.enabled": "true",
  "webhook.secret": "your-hmac-secret"
}
```

**响应**：返回更新后的完整设置对象（同 GET 响应格式）。
