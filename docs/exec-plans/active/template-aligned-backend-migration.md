# 模板对齐后端迁移计划

## 背景

项目已确认长期方向为：

- `frontend` 提供 React + Tiptap 写作体验
- `desktop` 作为 Electron 壳连接远端 API
- `backend` 参考 `full-stack-ai-agent-template` 的方式组织
- AI 运行框架改为 LangChain
- MVP 阶段使用日志做基础观测

当前仓库中的 `prototypes/local-agent` 仅是开发期过渡实现。

## 当前目标

1. 将当前前端工作区稳定在 `frontend`
2. 将云端能力收敛到单个 `backend` 目录内，而不是拆分多个空服务
3. 尽量复用模板已有的 FastAPI / LangChain / streaming / 分层组织能力
4. 逐步移除前端对本地 Node 原型的长期依赖

## 当前决策

- 不使用 Supabase 作为主后端方案
- 不以内置本地后端作为桌面端目标
- backend 内部按 `api / services / repos / agents / core` 分层
- LangChain 作为 AI 主框架
- MVP 观测先用日志，后续优先复用模板已有观测扩展点

## 待办

- 定义 backend 的最小目录骨架与运行入口
- 定义 rewrite 流程在 FastAPI + LangChain 中的最小实现方式
- 明确前端只调用 backend API 的接口边界
- 将当前 `prototypes/local-agent` 的能力迁移到 backend
