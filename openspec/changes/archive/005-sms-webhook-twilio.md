---
id: "005"
title: SMS Webhook Twilio 兼容格式与 API 凭证管理
status: released
date: "2026-10-22"
commit: 964d273
pr: "#4"
---

# SMS Webhook Twilio 兼容格式与 API 凭证管理

## 摘要

新增 API 凭证管理模块，实现基于 API Key 的 HTTP Basic Auth 认证方式，添加 Twilio 兼容 SMS 发送端点，支持第三方系统无缝集成。**SMS Webhook 推送格式发生破坏性变更**，从 JSON 改为 Twilio 兼容的 form-urlencoded 格式。变更量 +991/-38 行。

## 变更内容

### 新增：API 凭证管理（apps/api）

**实体（`src/entities/api-credential.entity.ts`）**
- 新增 `ApiCredential` 实体：apiKey（20字符唯一标识）、apiSecretHash（bcrypt 哈希）、name、expiresAt、isActive、lastUsedAt、revokedAt

**数据库迁移（`src/database/migrations/1729593600000-AddApiCredentials.ts`）**
- 新建 `api_credentials` 表

**后端模块**
- `CredentialsService`（`src/modules/credentials/credentials.service.ts`）：凭证创建（生成随机 apiKey + apiSecret，Secret 仅返回一次）、查询（Secret 显示为掩码）、撤销（设置 isActive=false、revokedAt）
- `CredentialsController`（`src/modules/credentials/credentials.controller.ts`）：
  - `POST /credentials`：创建凭证（支持 name 和 expiryDays 参数）
  - `GET /credentials`：列出所有凭证
  - `DELETE /credentials/:id`：撤销凭证
- `ApiKeyAuthGuard`（`src/modules/credentials/guards/api-key-auth.guard.ts`）：HTTP Basic Auth 验证，检查凭证有效性（isActive、expiresAt）

### 新增：Twilio 兼容端点（apps/api）

**TwilioModule**（`src/modules/twilio/`）
- `POST /twilio/Messages.json`：使用 API Key Basic Auth（非 JWT）
  - 请求格式：`application/x-www-form-urlencoded`（To、From、Body 字段）
  - 内部复用 SmsService 发送逻辑
  - 响应格式：Twilio API 兼容 JSON（sid、status、direction、api_version、date_created、uri 等字段）
  - 状态映射：`pending` → `queued`，`sent` → `sent`，`failed` → `failed`

### ⚠️ 破坏性变更：SMS Webhook 格式

**受影响文件**：`src/modules/webhooks/webhooks.service.ts`

SMS 收到时 Webhook 推送格式**从 JSON 变更为 Twilio 兼容的 form-urlencoded 格式**：

**变更前（JSON）**
```json
{
  "id": "uuid",
  "direction": "inbound",
  "phoneNumber": "+8613012345678",
  "content": "短信内容"
}
```

**变更后（application/x-www-form-urlencoded）**
```
From=+8613012345678&To=&Body=短信内容&MessageSid=uuid
```

对接 SMS Webhook 的外部系统需同步更新解析逻辑。

### 前端（apps/web）

- 新增 `CredentialsPage.tsx`（471 行）：凭证列表展示（apiKey 可见，Secret 掩码）、创建表单（备注名、过期天数）、撤销操作
- `App.tsx`：添加 `/credentials` 路由
- `Sidebar.tsx`：添加凭证管理导航项
- `api/client.ts`：新增凭证相关 API 方法（createCredential、listCredentials、revokeCredential）

## 影响的 Spec

- `credentials.md`（**新建**）：API 凭证数据模型、认证方式、端点定义、Twilio 兼容端点规格
- `webhooks.md`（**更新**）：SMS Webhook 请求体格式变更为 form-urlencoded，破坏性变更说明
- `sms.md`（**更新**）：补充 Twilio 兼容端点引用（指向 credentials.md）
