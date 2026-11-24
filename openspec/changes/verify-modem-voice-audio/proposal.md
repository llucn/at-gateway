## Why

通话功能依赖"把音频送入/取出通话"，但现有代码没有任何音频通路（`CPCMREG` 只是空方法，`TODO: Play TTS`）。实机探测发现当前设备是 A7670G-LLSE（固件 A7670M7_V1.11.1），**不支持 `AT+CPCMREG`**，USB 上也没有音频接口，原先"通过 USB PCM 流式收发"的假设不成立。必须先用真机验证可行的音频方案，再做正式的 phone call 功能。

## What Changes

- 新增两个可独立运行的验证脚本（`apps/api/src/sample/`）：
  - 呼出脚本：输入号码 → 拨打 → 等待接通 → 向对方播放 `sample-3s-8khz.wav` → 录下对方语音到 `output/`。
  - 接听脚本：等待来电 → 3 秒后接听 → 播放 `sample-3s-8khz.wav` → 录下对方语音到 `output/`。
- 音频方案采用模块侧文件能力：`AT+CFTRANRX` 上传、`AT+CCMXPLAY` 向对端播放、`AT+CREC` 录对端语音、`AT+CFTRANTX` 下载，录音保存为 8kHz 16-bit WAV。
- `.gitignore` 忽略 `output/`，并放行 `sample/*.wav`（现有 `*.wav` 规则会忽略示例音频）。
- 验证结论回写 `at-modem`（二进制传输、URC 缺陷）和后续 phone call 设计。

## Capabilities

### New Capabilities
- `modem-voice-audio`：通过 AT 命令在通话中播放音频文件、录制对端语音并取回的能力与验证脚本行为。

### Modified Capabilities
- 无（`calls` 规格待验证完成后在后续变更中修改）。

## Non-goals

- 不实现 TTS/STT、Twilio 兼容接口、GUI 拨号盘和通话记录页。
- 不修改现有 `CallsService` 和数据库结构。
- 不做实时流式音频。

## Impact

- 受影响 spec：新增 `modem-voice-audio`；后续将影响 `calls.md`、`recordings.md`。
- 代码：`apps/api/src/sample/`（新脚本）、`.gitignore`；可能小幅修改 `packages/at-modem`。
