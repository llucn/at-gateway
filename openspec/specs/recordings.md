# 录音（Recordings）

## 概述

存储通话录音文件，支持按通话 ID 关联查询。录音文件存储在服务器本地文件系统，API 提供元数据查询和管理。录音可触发 STT 自动转录。

## 数据模型：Recording

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| callId | UUID? | 关联的通话记录 ID |
| filePath | string | 服务器上的文件路径 |
| format | enum | `wav` \| `pcm` \| `amr` |
| duration | integer? | 录音时长（秒） |
| transcription | string? | STT 转录文字 |
| createdAt | datetime | 录音创建时间 |

## 音频规格

- 采样率：8000 Hz
- 声道：单声道（mono）
- 位深：16-bit PCM
- 默认格式：WAV

## API 端点

### GET /recordings

获取录音列表（分页）。需要 Bearer Token。

**查询参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码，从 1 开始，默认 1 |
| limit | integer | 每页条数，默认 20，最大 100 |
| callId | UUID | 按通话 ID 过滤 |

**响应**
```json
{
  "data": [ /* Recording 数组 */ ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

### GET /recordings/:id

获取单条录音元数据。需要 Bearer Token。

> 注：当前版本不提供音频文件流式下载端点，文件访问通过服务器文件系统或 Nginx 静态资源服务实现。
