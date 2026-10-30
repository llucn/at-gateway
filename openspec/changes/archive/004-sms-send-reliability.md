---
id: "004"
title: 短信发送可靠性修复（PDU 编解码）
status: released
date: "2026-10-22"
commit: 92818e2
pr: "#3"
---

# 短信发送可靠性修复（PDU 编解码）

## 摘要

修复 GSM-7 和 UCS-2 SMS PDU 编解码的底层 bug，解决接收短信乱码问题，提升 SMS 整体可靠性。新增 252 行 PDU 编解码测试套件。变更量 +883/-244 行。

## 变更内容

### Bug 修复（packages/at-modem）

**GSM-7 编解码（`src/codec/gsm-codec.ts`）**
- 修复位打包/解包的位顺序错误（bit packing/unpacking 顺序不正确导致解码乱码）
- 修复国际号码（`+` 前缀）在 PDU 地址字段中的处理逻辑

**UCS-2 编解码**
- 修复大端序编码问题（原实现字节序错误，导致中文等非 ASCII 字符解码乱码）

**URC 路由（`src/core/at-client.ts`）**
- 修正 `+CMT:` URC 处理流程：原实现未正确将 `+CMT:` 后续行路由给 SMS 管理器，导致串口缓冲区被 AT 响应污染，后续 SMS 解析出错
- SmsManager（`src/features/sms-manager.ts`）：配合 URC 路由修复，重构入站 SMS 处理流程

### 测试（packages/at-modem）

- 新增 PDU 编解码测试套件（`src/codec/pdu-codec.test.ts`，252 行）
- 覆盖场景：GSM-7 单条/级联 SMS、UCS-2 中文消息、国际号码 BCD 编码、边界情况

### 前端增强（apps/web）

- SMS 页面（`src/pages/SmsPage.tsx`）：
  - 添加字符计数器：实时显示当前使用的编码类型（GSM-7/UCS-2）及剩余可用字符数
  - 添加轮询刷新：定时拉取新短信，无需手动刷新

## 影响的 Spec

- `sms.md`：完善编码规则章节
  - 明确 GSM-7 位打包顺序（LSB 优先）
  - 明确 UCS-2 使用大端序（UTF-16 BE）
  - 补充 E.164 国际号码格式要求
