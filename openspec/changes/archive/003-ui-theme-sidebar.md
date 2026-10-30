---
id: "003"
title: 双主题 UI、侧边栏导航、仪表盘增强
status: released
date: "2026-10-21"
commit: c08397c
pr: "#2"
---

# 双主题 UI、侧边栏导航、仪表盘增强

## 摘要

全面升级前端 UI 体系，实现浅色/深色双主题，添加可折叠侧边栏导航，修复仪表盘信号质量显示，修复 ApiClient JWT 自动刷新逻辑。变更量 +3984/-245 行，主要为前端代码。

## 变更内容

### 主题系统（apps/web）

- 基于 CSS 变量实现浅色/深色主题切换（`src/styles/index.css`）
- 新增 Zustand 主题状态管理（`src/lib/theme-store.ts`），持久化到 localStorage
- 顶栏（48px）：汉堡菜单按钮、品牌标题、主题切换按钮、用户头像菜单

### 侧边栏导航

- 新增可折叠两级侧边栏组件（`src/components/layout/Sidebar.tsx`，展开宽度 225px）
- 支持一级和二级导航项，激活状态高亮

### 仪表盘增强

- 修复信号质量显示：添加 RSRP/RSRQ/SINR 详情卡
- 添加 SVG 信号强度图标（动态根据 RSSI 显示格数）
- 运营商名称查询：生成 2666 条 MCC+MNC 查找表（`src/lib/mcc-mnc.ts`，通过 `scripts/gen-mcc-mnc.js` 生成）

### Bug 修复

- ApiClient（`src/api/client.ts`）：修复 401 响应时 JWT 自动刷新逻辑
  - 原实现：每个 401 请求各自独立发起 refresh，导致并发请求时 refresh 被调用多次
  - 修复后：使用 Promise 队列合并并发 refresh 请求，刷新完成后统一重放待处理请求

## 影响的 Spec

- `status.md`：仪表盘展示 RSRP/RSRQ/SINR 字段，spec 中已补充完整 SignalQuality 结构
- `auth.md`：明确 401 自动刷新行为，包括并发合并说明
