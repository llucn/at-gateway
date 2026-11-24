## 1. 准备与设备探测

- [x] 1.1 创建分支 `feat/modem-voice-audio-verification` 和本 OpenSpec 变更
- [x] 1.2 探测设备型号、固件与音频相关 AT 命令支持情况
- [x] 1.3 `.gitignore` 增加 `output/`，并放行 `apps/api/src/sample/*.wav`

## 2. 验证脚本（后端）

- [x] 2.1 编写共享辅助模块：串口选择与占用提示、文件上传（CFTRANRX）、文件下载（CFTRANTX）、WAV 头校验
- [x] 2.2 编写呼出脚本 `dial-test.mjs`
- [x] 2.3 编写接听脚本 `answer-test.mjs`

## 3. 真机验证（测试）

- [x] 3.1 停止 `pnpm dev` 的 API 服务，释放 COM5
- [x] 3.2 运行呼出脚本，确认对方听到示例语音、`output/` 得到对方语音 WAV
- [x] 3.3 运行接听脚本，确认 3 秒后接听、播放与录音正常
- [x] 3.4 记录结果：录音格式、`+CLIP`/`RING` 顺序、接通与挂断 URC

## 4. 结论回写

- [x] 4.1 把验证结论更新到 design.md，并列出 `at-modem` 需要修复的问题（二进制传输、`+CREG` 响应被当作 URC、接通检测）
- [ ] 4.2 提出下一个变更：正式 phone call 功能的设计
