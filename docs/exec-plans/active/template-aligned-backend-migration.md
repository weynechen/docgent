# 模板对齐后端迁移计划

## 背景

项目已确认长期方向为：

- `frontend` 提供 React + Tiptap 写作体验
- `desktop` 作为 Electron 壳连接远端 API
- `backend` 参考 `full-stack-ai-agent-template` 的方式组织
- AI 运行框架改为 LangChain
- MVP 阶段使用日志做基础观测

模板已生成并融合到仓库主线，`backend` 现在直接采用模板生成的结构和运行方式。

## 当前目标

1. 将当前前端工作区稳定在 `frontend`
2. 将云端能力收敛到单个 `backend` 目录内，而不是拆分多个空服务
3. 尽量复用模板已有的 FastAPI / LangChain / streaming / 分层组织能力
4. 将前端 AI 调用切换到模板 backend 并清理过渡目录

## 当前决策

- 不使用 Supabase 作为主后端方案
- 不以内置本地后端作为桌面端目标
- backend 内部按 `api / services / repos / agents / core` 分层
- LangChain 作为 AI 主框架
- MVP 观测先用日志，后续优先复用模板已有观测扩展点

## 当前进展

- 模板后端已整体迁入根目录 `backend`
- 根级 `Makefile`、`docker-compose*.yml`、`nginx/` 已按模板方式接入
- 选区改写已实现为 `backend/app/api/routes/v1/rewrite.py`
- 前端 provider 已切换到 `/api/v1/ai/rewrite/*`

## 剩余工作

- 将 rewrite run 从内存态升级为更长期的任务模型
- 决定何时把文档/版本域从 mock 迁到后端
- 补充基于真实 HTTP/SSE 的端到端联调测试
