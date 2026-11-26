## ADDED Requirements

### Requirement: 来电由应用决定接听
配置了 `voice.incomingUrl` 时，来电 SHALL 在通知应用并取得 TwiML 后才决定接听或拒绝，网关不得在此之前自动接听。通话记录的 `metadata` SHALL 包含 `callSid`，媒体流通话还 SHALL 包含 `streamSid`。

#### Scenario: 应用要求接听
- **WHEN** 应用返回 `<Connect><Stream/></Connect>`
- **THEN** 通话记录状态依次为 `ringing`、`active`、`ended`，`metadata.callSid` 和 `metadata.streamSid` 已填写

#### Scenario: 应用拒绝
- **WHEN** 应用返回 `<Reject/>`
- **THEN** 通话记录状态为 `ended`，`answeredAt` 为空
