---
id: "002"
title: 修复构建流程与数据库迁移配置
status: released
date: "2026-10-21"
commit: c523e37
pr: "#1"
---

# 修复构建流程与数据库迁移配置

## 摘要

修复 monorepo 构建流程中的配置问题，建立数据库迁移机制，确保开发和生产环境可正常启动。变更量较小（+60/-6 行），属于基础设施修复。

## 变更内容

- 修复 pnpm workspace 构建依赖配置
- 配置 TypeORM 数据库迁移脚本（`migration:run`、`migration:generate`、`migration:revert`）
- 修复构建产物路径和模块解析问题
- 确保 `apps/api` 启动前完成共享包构建

## 影响的 Spec

无（基础设施变更，不影响任何 API 规格）
