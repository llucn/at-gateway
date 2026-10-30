# 认证（Auth）

## 概述

系统采用 JWT 双令牌认证机制。访问令牌（Access Token）有效期较短，刷新令牌（Refresh Token）用于续期。所有受保护端点需在请求头携带 Bearer Token。

## 用户模型

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | string | 唯一，最长 50 字符 |
| displayName | string? | 显示名称 |
| role | enum | `admin` \| `user` |
| isActive | boolean | 账号是否启用 |
| lastLoginAt | datetime? | 最后登录时间 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

## API 端点

### POST /auth/login

登录并获取令牌对。

**请求体**
```json
{ "username": "admin", "password": "string" }
```

**响应**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": 900,
  "user": { "id": "uuid", "username": "string", "role": "admin" }
}
```

### POST /auth/refresh

使用刷新令牌换取新的令牌对。

**请求体**
```json
{ "refreshToken": "string" }
```

**响应**：结构同 login，不含 user 字段。

### POST /auth/change-password

修改当前用户密码。需要 Bearer Token。

**请求体**
```json
{ "currentPassword": "string", "newPassword": "string（最少6字符）" }
```

### POST /auth/logout

客户端主导登出，服务端返回成功。令牌失效由客户端负责清除本地存储。

## 令牌规格

- Access Token：JWT HS256，有效期 15 分钟（900s）
- Refresh Token：JWT HS256，有效期 7 天
- 401 响应时，前端 ApiClient 自动尝试刷新，并发刷新请求会合并为一次，刷新失败则清除认证状态并重定向登录页

## 初始管理员账户

通过环境变量 `BOOTSTRAP_ADMIN_USERNAME` 和 `BOOTSTRAP_ADMIN_PASSWORD` 在首次启动时由 seed 脚本创建。
