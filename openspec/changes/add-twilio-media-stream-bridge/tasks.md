## 1. 可行性验证（先做）

- [ ] 1.1 编写验证脚本：连续分段录音（`AT+CREC=2` 停止再开始），测量分段间隙和取回耗时
- [ ] 1.2 验证录音期间能否并行 `AT+CFTRANTX` 取回上一段，记录往返延迟
- [ ] 1.3 验证连续两段 `AT+CCMXPLAY` 的间隙，以及 `AT+CCMXSTOP` 打断后的状态
- [ ] 1.4 把结论写入 design.md，确定默认分段长度和半双工策略

## 2. at-modem（后端）

- [x] 2.1 `SerialTransport` 增加原始字节读写；`AtClient` 支持无换行的 `>` 提示符
- [x] 2.2 实现文件上传（分块 `CFTRANRX`）和下载（解析 `+CFTRANTX: DATA`）
- [x] 2.3 `CallManager` 增加 `playToRemote`、`stopPlayback`、`startRecording`、`stopRecording`
- [x] 2.4 `CallManager` 接通判断改用 `AT+CLCC`，`hangup` 回退 `AT+CHUP`
- [x] 2.5 修复 `AT+CREG?` 等查询响应被当作 URC 的问题

## 3. 来电通知（后端）

- [x] 3.1 新增设置项 `voice.incomingUrl`、`voice.streamTimeoutMs`
- [x] 3.2 实现 `IncomingNotifier`：生成 `CallSid`，发起带签名的 form POST
- [x] 3.3 实现 TwiML 解析（`Connect/Stream`、`Hangup`、`Reject`）
- [x] 3.4 `CallsService` 来电流程改为"通知后由应用决定接听"，写入 `metadata`

## 4. 媒体流（后端）

- [x] 4.1 实现 G.711 μ-law 与 PCM16 互转
- [x] 4.2 实现 `MediaStreamSession`：连接、`connected`/`start`/`stop`、帧序号
- [x] 4.3 实现上行：分段录音 → 取回 → 切 20ms 帧 → `media`
- [x] 4.4 实现下行：累积 `media` → 生成 WAV → 上传 → 播放，处理 `mark` 和 `clear`
- [x] 4.5 通话结束和异常的清理（模块临时文件、WebSocket、状态）

## 5. 前端

- [x] 5.1 设置页增加 `voice.incomingUrl` 和 `voice.streamTimeoutMs`
- [x] 5.2 通话记录详情显示 `callSid` 和 `streamSid`

## 6. 测试

- [x] 6.1 G.711 转换和 TwiML 解析的单元测试
- [x] 6.2 用本地模拟应用（HTTP + WebSocket）对 `MediaStreamSession` 做协议测试
- [x] 6.3 真机联调：用 `ai-voice-assistant-openai-deepgram` 示例接收来电，验证 `media`/`mark`/`clear`
- [x] 6.4 更新 `calls.md`、`settings.md` 规格和 README
