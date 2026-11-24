## Context

- 设备：SIMCom A7670G-LLSE，固件 `A7670M7_V1.11.1`，Windows 下枚举为 AT 口（COM5）、诊断口（COM6）、Modem 口（COM4），RNDIS 被禁用，无 USB 音频接口。
- 探测结果：`AT+CPCMREG`、`AT+CLVL`、`AT+CCMXPLAYWAV` 返回 ERROR；`AT+CSDVC` 仅支持通道 1、3；`AT+CCMXPLAY`、`AT+CREC`、`AT+CFTRANRX`、`AT+CFTRANTX`、`AT+FSLS` 可用。
- `at-modem` 的 `AtClient` 按行解析（`\r\n`），`SerialTransport.write` 总是追加 `\r`，不能直接传输二进制。
- `AtClient.isUnsolicitedLine` 把 `+CREG:`、`+CEREG:` 等前缀一律当作 URC，导致 `AT+CREG?` 的查询响应丢失（探测时已复现，返回 `lines` 为空）。

## Goals / Non-Goals

**Goals:**
- 用真机证明：拨出/接听、对端播放、对端录音、文件取回全链路可用。
- 找出 `at-modem` 在语音场景的缺陷，作为正式功能的输入。

**Non-Goals:**
- 不追求实时双向音频；不集成 STT/TTS。

## Decisions

1. **音频走模块文件系统，不走 USB/PCM 流。** 设备不支持 `CPCMREG` 且无 USB 音频接口。备选：把模块模拟音频口接到电脑声卡（需要硬件改动，暂不考虑）。
2. **播放：** `AT+CFTRANRX="C:/sample.wav",<len>` 上传，通话中 `AT+CCMXPLAY="C:/sample.wav",1,0` 播给对端，等待 `+AUDIOSTATE: audio play stop`。
3. **录音：** 接通后 `AT+CREC=2,"C:/rec.wav"` 录对端语音，结束 `AT+CREC=0`，再用 `AT+CFTRANTX` 取回到 `output/`。录音是否为 8kHz 16-bit WAV 以真机结果为准，不符则在脚本中转换并记录结论。
4. **脚本使用 `@at-gateway/at-modem` 的 `AtClient` 发 AT 命令；** 二进制上传/下载通过 `SerialTransport` 内部的 `SerialPort` 句柄直接读写。这是验证性做法，正式功能再把它沉淀进 `at-modem`。
5. **脚本为 `.mjs`，** 不被 `nest build` 编译，也不受 `src/**/*.ts` 的 lint 约束，用 `node` 直接运行。
6. **接通检测：** 呼出不能依据 `ATD` 返回 OK 判断，改用 `AT+CLCC` 轮询（状态 0 = active）和 `VOICE CALL: BEGIN` / `NO CARRIER` 等 URC。

## Risks / Trade-offs

- [`CCMXPLAY` 可能无法向对端播放] → 脚本先记录真机行为；若不可行，结论写入 design 并回到方案讨论。
- [CFTRANTX 返回的二进制与行解析冲突] → 脚本同时挂接原始 `data` 监听，按 `+CFTRANTX: DATA,<len>` 切分；已知 `AtClient` 会把二进制行当作噪声。
- [COM5 被运行中的 `pnpm dev` API 占用] → 运行脚本前必须停止 API，或改用 Modem 口。
- [录音文件占用模块存储] → 脚本取回后删除模块文件。
- [真实拨号产生话费/打扰对方] → 脚本要求用户手动输入号码，不内置默认号码。

## Open Questions

- 录音是否原生 8kHz 16-bit WAV，是否包含静音头。
- 来电时 `+CLIP` 与 `RING` 的实际顺序，以及 `ATA` 后接通的 URC。

## 已验证的发现（无需通话）

- `AT+CFTRANRX` 的提示符是 `\r\n>`，没有结尾换行，`AtClient` 的行解析永远收不到它，`expectPrompt` 会超时。脚本改为直接监听原始字节。
- 单次 `CFTRANRX` 超过约 32KB 会返回 ERROR（20KB 正常），改用 `AT+CFTRANRX=<path>,<len>,100,<offset>` 分块（16000 字节）上传。
- 上传失败后模块会停在"等待文件数据"状态，之后发送的命令会被当作数据吞掉；需要补足剩余字节才能恢复。
- `AT+CFTRANTX` 输出为 `+CFTRANTX: DATA,<len>\r\n<bytes>\r\n+CFTRANTX: 0`，上传再下载 48044 字节与原文件逐字节一致。
- 模块回显（ATE1）开启；`AT+CVHU?` 返回 1，`ATH` 可能无法挂断语音通话，脚本在挂断后用 `AT+CLCC` 校验并回退到 `AT+CHUP`。
- Windows 下 AT 口为 COM5，Modem 口 COM4 也能执行 AT 命令；运行 `pnpm dev` 时 API 占用 COM5。

## 接听流程真机验证结果（2026-11-24）

- 来电 URC 顺序：`RING` → `+CLIP: "<号码>",145`；`AT+CLCC` 在振铃时状态为 4（incoming），`ATA` 后为 0（active）。
- `AT+CCMXPLAY="C:/x.wav",1,0` 可向对端播放，对端听到清晰的示例语音。
- **`AT+CCMXPLAY` 在 `AT+CREC=2` 录音期间返回 ERROR**，播放和录音不能同时进行，必须先播放、播完再录音。这意味着用户在播放期间说的话不会被录到。
- `AT+CREC=2,"C:/vt_rec.wav"` 录下的对端语音是 8000Hz、16-bit、单声道 PCM WAV，14.74 秒，内容有明显语音电平变化。
- 对端挂断后 `AT+CLCC` 变为空列表，可据此判断通话结束；`ATH` 在 `AT+CVHU=1` 下不能挂断，需要 `AT+CHUP`。

## 呼出流程真机验证结果（2026-11-24）

- `ATD<号码>;` 约 0.3 秒就返回 OK，此时对方尚未接听；`AT+CLCC` 在约 7 秒后变为 active（状态 0）才表示接通。因此 `CallManager.dial()` 把状态直接设为 `active` 是错误的，必须以 `AT+CLCC` 或 URC 为准。
- 接通后播放示例语音，再录音，对端挂断后录到 9.38 秒 8kHz 16-bit 单声道 WAV，有明显的语音电平。
- 呼出和接听两个方向的播放、录音、取回流程都已在真机验证通过。
