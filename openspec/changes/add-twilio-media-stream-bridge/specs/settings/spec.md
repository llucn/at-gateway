## ADDED Requirements

### Requirement: 来电语音通知设置
系统 SHALL 提供以下设置项，用于来电的 Twilio 兼容通知和媒体流：

| 键 | 类型 | 默认值 | 说明 |
|----|------|--------|------|
| `voice.incomingUrl` | string | 空 | 来电时通知的 HTTP URL，空表示不启用 |
| `voice.streamTimeoutMs` | number | `10000` | 建立媒体流 WebSocket 的超时（毫秒） |

通知请求的超时和签名密钥沿用 `webhook.timeoutMs` 和 `webhook.secret`。

#### Scenario: 设置通知地址
- **WHEN** 管理员把 `voice.incomingUrl` 设为 `https://app.example.com/incoming`
- **THEN** 之后的来电会向该地址发起通知

#### Scenario: 清空通知地址
- **WHEN** 管理员把 `voice.incomingUrl` 设为空
- **THEN** 来电不再发起通知，保持只记录、不接听
