## ADDED Requirements

### Requirement: 呼出验证脚本
系统 SHALL 提供呼出验证脚本：等待用户在终端输入号码，拨打后等待对方接通，接通后向对方播放 `sample-3s-8khz.wav`，并把对方语音保存为 8kHz 16-bit 单声道 WAV 到 `output/` 目录。

#### Scenario: 对方接听
- **WHEN** 用户输入有效号码且对方接听
- **THEN** 脚本向对方播放示例语音，录下对方语音，播放结束后挂断，并在 `output/` 生成 WAV 文件

#### Scenario: 对方未接听或拒接
- **WHEN** 对方忙线、拒接或超时未接
- **THEN** 脚本输出失败原因，不生成录音，并以非零状态退出

#### Scenario: 空号码
- **WHEN** 用户输入空行或非法号码
- **THEN** 脚本提示重新输入，不发起拨号

### Requirement: 接听验证脚本
系统 SHALL 提供接听验证脚本：等待来电，来电后等待 3 秒再接听，接通后向对方播放 `sample-3s-8khz.wav`，并把对方语音保存为 8kHz 16-bit 单声道 WAV 到 `output/` 目录。

#### Scenario: 来电被接听
- **WHEN** 有来电且主叫未挂断
- **THEN** 脚本在振铃 3 秒后接听，播放示例语音，录下对方语音并在通话结束后保存

#### Scenario: 主叫在接听前挂断
- **WHEN** 3 秒等待期间主叫挂断
- **THEN** 脚本不接听，回到等待来电状态

### Requirement: 录音输出
验证脚本 SHALL 将录音保存到 `output/` 目录，文件名包含方向和时间戳，格式为 8000Hz、16-bit、单声道 WAV；`output/` 目录 SHALL 被 git 忽略。

#### Scenario: 保存录音
- **WHEN** 通话结束且模块中存在录音文件
- **THEN** 脚本取回文件到 `output/`，校验 WAV 头，并输出采样率、位深、时长

### Requirement: 设备串口占用
验证脚本 SHALL 在串口被其他进程占用时给出明确提示，而不是抛出未处理的错误。

#### Scenario: 串口被占用
- **WHEN** 配置的 AT 口无法打开（例如已被 API 服务占用）
- **THEN** 脚本提示"串口被占用，请先停止 API 服务"并退出
