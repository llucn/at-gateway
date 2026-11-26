## Why

第三方语音应用（如 `ai-voice-assistant-openai-deepgram`）按 Twilio 协议开发：来电时由 Twilio 请求 `/incoming`、再经 WebSocket `/connection` 收发音频。网关需扮演 Twilio 一侧，让这类应用直接接入 A7670 来电，网关自身不做 TTS/STT。

## What Changes

- 来电通知：向配置的 URL 发 Twilio 格式 HTTP POST，解析返回的 TwiML。
- 语音交换：TwiML 为 `<Connect><Stream>` 时接听，作为 WebSocket 客户端按 Media Streams 协议收发 `start`/`media`/`mark`/`clear`/`stop`，音频 8kHz μ-law。
- 模块只能文件播放/录音且不能同时进行，音频按半双工分段交换，需先做可行性验证。

## Capabilities

### New Capabilities
- `twilio-incoming-call-webhook`：来电通知与 TwiML 子集。
- `twilio-media-stream`：WebSocket 媒体流协议与音频转换。

### Modified Capabilities
- `settings`：新增来电通知 URL。
- `calls`：来电由应用决定接听。

## Non-goals

- 不做 TTS/STT/AI 对话、外呼、其他 TwiML 动词、`X-Twilio-Signature`、全双工实时流。

## Impact

- spec：新增两个能力，修改 `settings.md`、`calls.md`。
- 代码：`apps/api` 新增模块，`packages/at-modem` 增加二进制传输和分段录放，新增 `ws` 依赖。
- 示例目录是独立 git 仓库，不纳入本仓库。
