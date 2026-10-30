# API 凭证（Credentials）

## 概述

API 凭证用于第三方系统（如 Twilio 兼容客户端）通过 HTTP Basic Auth 访问特定端点。凭证由 API Key 和 API Secret 组成，Secret 仅在创建时明文返回一次，后续仅存储 bcrypt 哈希值，不可还原。

## 数据模型：ApiCredential

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | string? | 凭证备注名，最长 100 字符 |
| apiKey | string | 20 字符唯一标识，公开可见 |
| apiSecretHash | string | API Secret 的 bcrypt 哈希，不可逆 |
| expiresAt | datetime? | 过期时间，`null` 表示永不过期 |
| isActive | boolean | 是否有效，撤销后为 `false` |
| lastUsedAt | datetime? | 最后使用时间 |
| revokedAt | datetime? | 撤销时间 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

## 认证方式

Twilio 兼容端点（`/api/twilio/*`）使用 HTTP Basic Auth：
- Username：apiKey
- Password：apiSecret（明文，服务端与 bcrypt 哈希比对）

凭证验证规则：
- `isActive` 必须为 `true`
- `expiresAt` 为 `null` 或大于当前时间
- 验证成功后更新 `lastUsedAt`

## API 端点

### POST /credentials

创建新凭证。需要 Bearer Token。

**请求体**
```json
{
  "name": "我的集成",
  "expiryDays": 365
}
```

`expiryDays` 传 `null` 或省略表示永不过期。

**响应**（`apiSecret` 仅此一次明文返回，之后无法再查看）
```json
{
  "id": "uuid",
  "name": "我的集成",
  "apiKey": "AKXXXXXXXXXXXXXXXXXX",
  "apiSecret": "明文 Secret，仅此一次",
  "expiresAt": "2027-10-22T00:00:00Z",
  "isActive": true,
  "createdAt": "2026-10-22T10:00:00Z"
}
```

### GET /credentials

获取凭证列表。需要 Bearer Token。响应列表中 `apiSecret` 显示为掩码（`••••••••`），不返回原始值。

**响应**
```json
[
  {
    "id": "uuid",
    "name": "我的集成",
    "apiKey": "AKXXXXXXXXXXXXXXXXXX",
    "apiSecret": "••••••••",
    "expiresAt": "2027-10-22T00:00:00Z",
    "isActive": true,
    "lastUsedAt": "2026-10-22T10:00:00Z",
    "createdAt": "2026-10-22T10:00:00Z"
  }
]
```

### DELETE /credentials/:id

撤销凭证。需要 Bearer Token。撤销后 `isActive` 变为 `false`，`revokedAt` 记录撤销时间。已撤销的凭证无法再用于 API Key 认证。

## Twilio 兼容端点

### POST /twilio/Messages.json

发送短信（Twilio 兼容格式）。使用 API Key Basic Auth（不是 JWT）。

**请求格式**：`application/x-www-form-urlencoded` 或 `application/json`

**请求字段**

| 字段 | 说明 |
|------|------|
| `To` | 目标手机号，E.164 格式 |
| `From` | 发送方标识（固定为 `gateway`） |
| `Body` | 短信内容 |

**响应**（Twilio 兼容格式）
```json
{
  "sid": "uuid",
  "to": "+8613012345678",
  "from": "gateway",
  "body": "消息内容",
  "status": "queued",
  "direction": "outbound-api",
  "api_version": "2010-04-01",
  "date_created": "2026-10-22T10:00:00Z",
  "uri": "/api/twilio/Messages/{sid}.json"
}
```

**状态映射**

| 内部状态 | Twilio 状态 |
|---------|------------|
| pending | queued |
| sent | sent |
| failed | failed |
