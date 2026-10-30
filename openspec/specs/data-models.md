# 数据模型总览

## 概述

本文汇总所有数据库实体的完整字段定义，作为各功能域 spec 的规范性参考。数据库采用 MySQL/MariaDB，通过 TypeORM 管理实体和迁移。

## 实体列表

| 实体 | 表名 | 所属功能域 |
|------|------|-----------|
| User | users | [认证](./auth.md) |
| SmsMessage | sms_messages | [短信](./sms.md) |
| CallRecord | call_records | [通话](./calls.md) |
| Recording | recordings | [录音](./recordings.md) |
| ApiCredential | api_credentials | [API 凭证](./credentials.md) |
| Setting | settings | [系统设置](./settings.md) |
| WebhookDelivery | webhook_deliveries | [Webhook](./webhooks.md) |
| ModemEvent | modem_events | 调制解调器事件日志 |

## 公共约定

- **主键**：所有实体使用 UUID v4（`PrimaryGeneratedColumn('uuid')`）
- **时间戳**：`createdAt` / `updatedAt` 由 TypeORM `@CreateDateColumn` / `@UpdateDateColumn` 自动维护，精度为毫秒
- **枚举**：数据库层面使用 `ENUM` 类型，TypeScript 层面使用 `enum` 常量
- **可空字段**：标注 `?` 的字段在数据库中为 `NULL`，接口响应中为 `null`
- **软删除**：当前版本不使用软删除机制；凭证通过 `isActive` 标记状态，撤销记录保留

## 实体详细定义

### User

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| username | varchar(50) | 否 | 唯一，用于登录 |
| passwordHash | varchar | 否 | bcrypt 哈希，不可逆 |
| displayName | varchar(100) | 是 | 显示名称 |
| role | enum(admin, user) | 否 | 角色 |
| isActive | boolean | 否 | 是否启用，默认 true |
| lastLoginAt | datetime | 是 | 最后登录时间 |
| createdAt | datetime | 否 | 创建时间 |
| updatedAt | datetime | 否 | 更新时间 |

### SmsMessage

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| direction | enum(inbound, outbound) | 否 | 方向 |
| phoneNumber | varchar(20) | 否 | E.164 格式 |
| content | text | 否 | 短信内容 |
| status | enum(pending, sent, failed, received) | 否 | 状态 |
| encoding | enum(gsm7, ucs2, binary) | 否 | 编码类型 |
| deliveredAt | datetime | 是 | 投递成功时间 |
| failureReason | text | 是 | 失败原因 |
| webhookDelivered | boolean | 否 | Webhook 是否已推送，默认 false |
| metadata | json | 是 | 扩展元数据（如 PDU 原始数据） |
| createdAt | datetime | 否 | 创建时间 |
| updatedAt | datetime | 否 | 更新时间 |

**索引**：`(direction, status)`、`phoneNumber`、`createdAt`

### CallRecord

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| direction | enum(inbound, outbound) | 否 | 方向 |
| phoneNumber | varchar(20) | 否 | E.164 格式 |
| status | enum(initiating, ringing, active, ended, failed, missed) | 否 | 通话状态 |
| startedAt | datetime | 否 | 呼叫发起时间 |
| answeredAt | datetime | 是 | 接通时间 |
| endedAt | datetime | 是 | 结束时间 |
| duration | int | 是 | 通话时长（秒） |
| failureReason | text | 是 | 失败原因 |
| recordingId | UUID | 是 | 关联录音 ID |
| transcription | text | 是 | 语音转文字结果 |
| webhookDelivered | boolean | 否 | Webhook 是否已推送，默认 false |
| metadata | json | 是 | 扩展元数据 |
| createdAt | datetime | 否 | 创建时间 |
| updatedAt | datetime | 否 | 更新时间 |

**索引**：`(direction, status)`、`phoneNumber`、`startedAt`

### Recording

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| callId | UUID | 是 | 关联的通话记录 ID |
| filePath | varchar | 否 | 服务器文件路径 |
| format | enum(wav, pcm, amr) | 否 | 音频格式 |
| duration | int | 是 | 录音时长（秒） |
| fileSize | int | 是 | 文件大小（字节） |
| transcription | text | 是 | STT 转录文字 |
| createdAt | datetime | 否 | 录音时间 |
| updatedAt | datetime | 否 | 更新时间 |

**索引**：`callId`、`createdAt`

### ApiCredential

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| name | varchar(100) | 是 | 备注名 |
| apiKey | varchar(20) | 否 | 唯一，公开可见标识符 |
| apiSecretHash | varchar | 否 | bcrypt 哈希，不可逆 |
| expiresAt | datetime | 是 | 过期时间，null 表示永不过期 |
| isActive | boolean | 否 | 是否有效，默认 true |
| lastUsedAt | datetime | 是 | 最后使用时间 |
| revokedAt | datetime | 是 | 撤销时间 |
| createdAt | datetime | 否 | 创建时间 |
| updatedAt | datetime | 否 | 更新时间 |

**索引**：`apiKey`（唯一）、`isActive`、`expiresAt`

### Setting

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| key | varchar(100) | 否 | 主键（配置键名） |
| value | text | 是 | 配置值（字符串形式） |
| updatedAt | datetime | 否 | 更新时间 |

> Setting 以 `key` 作为主键，不使用 UUID。

### WebhookDelivery

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| eventType | varchar(50) | 否 | 事件类型（如 sms.received） |
| url | varchar | 否 | 推送目标 URL |
| payload | text | 否 | 推送内容（序列化字符串） |
| metadata | json | 是 | 附加信息（如 Content-Type、Headers） |
| attempts | int | 否 | 已尝试推送次数，默认 0 |
| lastAttemptAt | datetime | 是 | 最后尝试时间 |
| nextRetryAt | datetime | 是 | 下次重试计划时间 |
| deliveredAt | datetime | 是 | 成功投递时间 |
| failureReason | text | 是 | 最后失败原因 |
| status | enum(pending, delivered, failed) | 否 | 投递状态 |
| createdAt | datetime | 否 | 记录创建时间 |

**索引**：`status`、`nextRetryAt`

### ModemEvent

调制解调器事件日志，用于记录 URC 和状态变化历史，仅内部使用。

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| id | UUID | 否 | 主键 |
| type | varchar(50) | 否 | 事件类型 |
| data | json | 是 | 事件原始数据 |
| createdAt | datetime | 否 | 事件时间 |

## 索引策略总结

| 表 | 索引 | 用途 |
|----|------|------|
| sms_messages | (direction, status) | 按方向和状态过滤 |
| sms_messages | phoneNumber | 按号码查询会话 |
| sms_messages | createdAt | 时间范围分页 |
| call_records | (direction, status) | 按方向和状态过滤 |
| call_records | phoneNumber | 按号码查询通话 |
| call_records | startedAt | 时间范围分页 |
| recordings | callId | 按通话查询录音 |
| api_credentials | apiKey UNIQUE | API 密钥快速查找 |
| api_credentials | isActive | 有效凭证过滤 |
| webhook_deliveries | (status, nextRetryAt) | 待重试任务扫描 |
