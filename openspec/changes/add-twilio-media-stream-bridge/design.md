## Context

- 示例应用（`app.js`）暴露 `POST /incoming`，返回 `<Response><Connect><Stream url="wss://<SERVER>/connection"/></Connect></Response>`；`/connection` 是 WebSocket 服务端，处理 `start`、`media`（base64 μ-law 8kHz）、`mark`、`stop`，并向 Twilio 发送 `media`、`mark`、`clear`（用户打断时清空待播放音频）。网关要扮演 Twilio，即 HTTP 客户端加 WebSocket 客户端。
- 已验证的设备能力（见归档变更 `2026-11-26-verify-modem-voice-audio`）：音频只能走模块文件系统；`AT+CCMXPLAY` 可向对端播放；`AT+CREC=2` 可录对端语音；**播放期间不能录音**；下载 235KB 录音耗时约 4 秒；`ATH` 无效须用 `AT+CHUP`；`CFTRANRX` 单次超过约 32KB 失败，须分块。
- 现有 `CallsService.handleIncomingCall` 只写记录并发 `webhook.call.incoming`，`CallManager` 无来电接听流程以外的音频能力。

## Goals / Non-Goals

**Goals:**
- 示例应用不改代码即可接收来电并收发语音。
- 协议字段与 Twilio Media Streams 一致，应用侧可复用 Twilio 示例。

**Non-Goals:**
- 全双工、低延迟（示例标称约 1 秒）；X-Twilio-Signature；其他 TwiML 动词。

## Decisions

1. **新增 `voice-bridge` 模块（`apps/api/src/modules/voice-bridge/`），** 包含 `IncomingNotifier`（HTTP 通知 + TwiML 解析）、`MediaStreamSession`（每通来电一个 WebSocket 客户端会话）、`G711`（μ-law 与 PCM16 互转）。TwiML 只用正则/轻量 XML 解析器解析 `Connect/Stream`、`Hangup`、`Reject`，不引入 twilio SDK。
2. **WebSocket 客户端用 `ws` 库。** 备选 Node 内置 `WebSocket`；`ws` 能设置请求头且行为稳定。
3. **半双工分段交换：** 录音循环（`AT+CREC=2` 分段，每段 N 毫秒，取回后转 μ-law，切成 20ms/160 字节的 `media` 帧发送）与播放队列（应用发来的 `media` 累积成 WAV，上传后 `AT+CCMXPLAY` 播放）交替执行；播放时暂停录音。N 的取值和是否可"录音时并行下载"由可行性验证确定。
4. **`mark` 语义：** 一段音频的播放结束 URC（`+AUDIOSTATE: audio play stop`）到达时回送对应 `mark`；`clear` 映射为 `AT+CCMXSTOP` 并丢弃队列，同样回送未完成的 `mark`。
5. **来电流程：** `RING` → `+CLIP` → 创建通话记录 → 向通知 URL POST（超时 `webhook.timeoutMs`）→ 返回 `Connect/Stream` 则 `ATA` 接听并建立媒体流；`Hangup`/`Reject`/通知失败则 `AT+CHUP`，通话记录标记原因。未配置通知 URL 时保持现有行为（不接听）。
6. **通话结束：** 模块侧挂断（`AT+CLCC` 为空）或应用关闭 WebSocket 时发送 `stop`、关闭连接、清理模块临时文件。
7. **`at-modem` 补充：** 二进制传输（`CFTRANRX`/`CFTRANTX` 使用原始字节并处理无换行的 `>` 提示符）、`CallManager` 的 `playToRemote`/`stopPlayback`/`startRecording`/`stopRecording`、用 `AT+CLCC` 判断接通、`hangup` 回退 `AT+CHUP`。这些是验证脚本中已经证明可行的做法，正式沉淀进包里。
8. **ID 格式：** `CallSid` 为 `CA` + 32 位十六进制，`StreamSid` 为 `MZ` + 32 位十六进制，与 Twilio 一致。

## Risks / Trade-offs

- [半双工分段导致延迟达数秒，应用的 VAD/打断体验变差] → 把延迟作为已知限制写入 spec；先做可行性验证，量化往返延迟后再定默认分段长度。
- [播放期间录不到对方说话，打断（barge-in）无法检测] → 本期不保证打断；`clear` 仍可由应用主动发送。
- [分段边界处音频丢失（停止再开始录音的间隙）] → 验证阶段测量间隙，必要时用重叠录音。
- [CREC 文件有大小上限（`+CREC: file full`）] → 分段长度远小于上限；每段取回后删除。
- [模块文件系统约 4MB] → 播放缓存按段上传、播放后删除。
- [应用不可达或响应慢导致来电一直振铃] → 通知请求超时即挂断。

## Migration Plan

- 新增设置项默认为空，不影响现有短信和通话功能；回滚只需清空该设置项。
- `at-modem` 新增方法不改变现有方法签名，`hangup` 行为改为失败回退 `AT+CHUP`。

## Resolved Decisions

- 通知请求带 HMAC 签名头（`X-Gateway-Signature`/`X-Gateway-Timestamp`），算法与现有 Webhook 一致。
- 延迟是否可接受暂不评估，先把功能跑通；分段长度默认 2000ms（见下方真机测量），`MediaStreamSession` 的 `segmentMs` 可配置，真机数据到手后再调整。
- 应用关闭 WebSocket 后网关挂断来电，不回到等待 TwiML。

## 真机测量结论（A7670G，`segment-spike.mjs`，3 次通话）

| 项目 | 结果 |
|------|------|
| 1s 分段录音 | 每段得到 0.86–0.96s 音频，WAV 均为 8kHz/16bit/单声道 |
| `AT+CREC=0` 后立刻 `AT+CREC=2` | 总是 ERROR；约需 300–400ms 才被接受，分段间隙约 440ms（停止→重启），音频在间隙内丢失 |
| 录音时并行下载上一段 | 可行：`AT+CFTRANTX` 约 100–120ms（约 15KB），不影响正在进行的录音 |
| 连续 `AT+CCMXPLAY` | 间隙不可测（第二次命令 10ms 内被接受，3s 音频总耗时 3.04s） |
| `AT+CCMXSTOP` | 26ms 内收到 `audio play stop`，之后可立即再次播放 |
| 录音结束后立即 `AT+CCMXPLAY` | 首次返回 ERROR，约 100ms 后重试成功 |
| 上传 48KB | 约 1.2s（分块 16KB） |

结论：
- 录音必须是"录一段、停止、下载、再录"，每个分段边界丢失约 440ms；分段越长覆盖越高：1s≈62%，2s≈82%，3s≈87%。默认分段 2000ms，应用侧对话延迟约为分段长度加数百毫秒。
- 下载可与下一段录音并行（实现上先 `stop`、等待可重启后 `start` 下一段，再取回上一段）；本期实现为串行取回（约 100ms），未并行优化。
- `CallManager` 对 `AT+CCMXPLAY`/`AT+CREC` 的 ERROR 每 100ms 重试，最多 15 次。
- 播放不丢帧、可立即打断；半双工策略不变：有待播音频时先播放，播放期间不录音。

## Open Questions

- 若需提高上行覆盖率，可评估重叠录音（两个文件交替）是否被固件支持（本次未测）。
