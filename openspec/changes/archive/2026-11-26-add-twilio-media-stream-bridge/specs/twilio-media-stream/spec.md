## ADDED Requirements

### Requirement: 媒体流连接
网关 SHALL 作为 WebSocket 客户端连接 TwiML `<Stream url>` 指定的地址，连接建立后依次发送 `connected` 和 `start` 消息。每通来电对应一个连接。

消息均为 JSON 文本帧。网关发送的消息：

| 事件 | 结构 |
|------|------|
| `connected` | `{"event":"connected","protocol":"Call","version":"1.0.0"}` |
| `start` | `{"event":"start","sequenceNumber":"1","streamSid":"MZ…","start":{"streamSid":"MZ…","accountSid":"AC…","callSid":"CA…","tracks":["inbound"],"mediaFormat":{"encoding":"audio/x-mulaw","sampleRate":8000,"channels":1},"customParameters":{}}}` |
| `media` | `{"event":"media","sequenceNumber":"<n>","streamSid":"MZ…","media":{"track":"inbound","chunk":"<n>","timestamp":"<毫秒>","payload":"<base64 μ-law>"}}` |
| `mark` | `{"event":"mark","sequenceNumber":"<n>","streamSid":"MZ…","mark":{"name":"<标签>"}}` |
| `stop` | `{"event":"stop","sequenceNumber":"<n>","streamSid":"MZ…","stop":{"accountSid":"AC…","callSid":"CA…"}}` |

网关接收的消息：`media`（`media.payload` 为 base64 μ-law）、`mark`（`mark.name`）、`clear`。其他事件 SHALL 被忽略。

#### Scenario: 连接成功
- **WHEN** WebSocket 连接建立
- **THEN** 网关先发送 `connected`，再发送 `start`，`start.streamSid` 与后续消息的 `streamSid` 一致

#### Scenario: 连接失败
- **WHEN** 无法连接到 Stream 地址
- **THEN** 网关挂断来电，通话记录状态为 `failed`

### Requirement: 来电语音上行
网关 SHALL 把主叫方的语音转换为 8kHz 单声道 μ-law，按 20 毫秒（160 字节）一帧，以 `media` 消息持续发送给应用，`sequenceNumber` 和 `chunk` 单调递增，`timestamp` 为自 `start` 起的毫秒数。

#### Scenario: 收到主叫语音
- **WHEN** 通话中网关取得一段主叫录音
- **THEN** 网关把它切成 160 字节的帧，依次发送 `media` 消息，`payload` 解码后为 μ-law 数据

### Requirement: 应用语音下行
网关 SHALL 把应用发送的 `media` 音频（base64 μ-law，8kHz）转换为 PCM 并通过模块向主叫播放。音频 SHALL 按到达顺序播放，不得乱序或重叠。

#### Scenario: 播放应用语音
- **WHEN** 应用发送一条或多条 `media` 消息
- **THEN** 网关按顺序把音频播放给主叫

### Requirement: 播放完成标记
应用发送 `mark` 后，网关 SHALL 在该标记之前的所有音频播放完毕时，回送相同 `mark.name` 的 `mark` 消息。

#### Scenario: 标记回送
- **WHEN** 应用先发送 `media` 再发送 `mark`（`name=abc`），且音频播放完毕
- **THEN** 网关发送 `{"event":"mark",…,"mark":{"name":"abc"}}`

### Requirement: 清空播放队列
应用发送 `clear` 后，网关 SHALL 立即停止当前播放，丢弃尚未播放的音频，并对被丢弃的 `mark` 依次回送。

#### Scenario: 打断
- **WHEN** 网关正在播放，应用发送 `clear`
- **THEN** 网关停止播放，丢弃队列，并回送未完成的 `mark`

### Requirement: 半双工限制
由于模块不支持播放时录音，网关 SHALL 在播放期间暂停上行语音，不发送该期间的 `media`。上行与下行 SHALL 交替进行，单向延迟以验证结果为准并记录在设计文档中。

#### Scenario: 播放时无上行
- **WHEN** 网关正在向主叫播放应用语音
- **THEN** 网关不发送 `media` 消息，播放结束后恢复上行

### Requirement: 通话结束
通话结束（主叫挂断、网关挂断或应用关闭连接）时，网关 SHALL 发送 `stop`（如连接仍可用）、关闭 WebSocket，并清理模块上的临时音频文件。应用主动关闭连接时，网关 SHALL 挂断来电。

#### Scenario: 主叫挂断
- **WHEN** 主叫挂断
- **THEN** 网关发送 `stop`，关闭 WebSocket，通话记录状态为 `ended`

#### Scenario: 应用关闭连接
- **WHEN** 应用先关闭 WebSocket
- **THEN** 网关挂断来电，通话记录状态为 `ended`

### Requirement: 音频格式转换
网关 SHALL 在模块侧 8kHz 16-bit 单声道 PCM 与 G.711 μ-law 之间无损往返转换采样率和声道，仅有 μ-law 压缩带来的量化误差。

#### Scenario: 往返转换
- **WHEN** 一段 PCM 先转 μ-law 再转回 PCM
- **THEN** 采样数不变，逐样本误差在 G.711 量化误差范围内
