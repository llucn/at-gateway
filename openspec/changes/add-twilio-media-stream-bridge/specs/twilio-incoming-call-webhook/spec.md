## ADDED Requirements

### Requirement: 来电 HTTP 通知
网关 SHALL 在收到来电并识别主叫号码后，向设置项 `voice.incomingUrl` 发起 HTTP POST，请求体为 `application/x-www-form-urlencoded`，字段如下：

| 字段 | 说明 |
|------|------|
| `CallSid` | `CA` + 32 位十六进制，网关为该通来电生成 |
| `AccountSid` | `AC` + 32 位十六进制，固定值 |
| `From` | 主叫号码，E.164 格式；未识别时为空字符串 |
| `To` | 本机号码；未知时为空字符串 |
| `CallStatus` | 固定为 `ringing` |
| `Direction` | 固定为 `inbound` |
| `ApiVersion` | 固定为 `2010-04-01` |

请求 SHALL 带 `X-Gateway-Signature`、`X-Gateway-Timestamp` 请求头，签名算法与现有 Webhook 一致。

#### Scenario: 发出来电通知
- **WHEN** 配置了 `voice.incomingUrl`，且收到来自 `+8613012345678` 的来电
- **THEN** 网关向该 URL 发起 POST，`From=+8613012345678`、`Direction=inbound`、`CallStatus=ringing`

#### Scenario: 未配置通知地址
- **WHEN** `voice.incomingUrl` 为空
- **THEN** 网关不发起通知，来电保持现有行为（只记录，不接听）

#### Scenario: 通知超时或失败
- **WHEN** 通知请求超时（`webhook.timeoutMs`）、连接失败或返回非 2xx
- **THEN** 网关挂断来电，通话记录状态为 `failed`，`failureReason` 记录原因

### Requirement: TwiML 响应处理
网关 SHALL 解析通知响应（`text/xml`）中的 TwiML，仅支持以下三种动词，其余动词 SHALL 被忽略并记录警告：

| 动词 | 行为 |
|------|------|
| `<Connect><Stream url="..."/></Connect>` | 接听来电，建立媒体流（见 `twilio-media-stream`） |
| `<Hangup/>` | 接听后立即挂断 |
| `<Reject/>` | 不接听，直接挂断 |

#### Scenario: 返回 Connect/Stream
- **WHEN** 响应为 `<Response><Connect><Stream url="wss://app.example.com/connection"/></Connect></Response>`
- **THEN** 网关接听来电，并连接该 WebSocket 地址

#### Scenario: 返回 Reject
- **WHEN** 响应为 `<Response><Reject/></Response>`
- **THEN** 网关不接听，挂断来电，通话记录状态为 `ended`

#### Scenario: 无可执行动词
- **WHEN** 响应为空 `<Response/>` 或仅包含不支持的动词
- **THEN** 网关挂断来电，并记录警告

#### Scenario: Stream 地址非法
- **WHEN** `url` 缺失或协议不是 `ws://` 或 `wss://`
- **THEN** 网关挂断来电，通话记录状态为 `failed`
