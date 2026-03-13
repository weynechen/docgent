# Writing IDE MVP

这是一个以 `frontend` 为当前主工作区，并逐步向 `full-stack-ai-agent-template` 风格后端演进的 Docs-as-Code AI 写作 IDE 原型仓库。

## 文档入口

- 产品规格：`product-specs/index.md`
- 设计文档：`design-docs/index.md`
- 架构地图：`../ARCHITECTURE.md`
- 计划与技术债：`PLANS.md`

## 当前状态

项目已完成第一轮工作台 UI 与编辑体验建设，并已从单前端目录调整为面向后续云端服务演进的结构。

当前目录结构：

- `frontend`：当前 React/Tiptap 前端
- `desktop`：预留的 Electron 桌面壳
- `backend`：预留的 Python 后端主目录，按模板方式分层
- `prototypes/local-agent`：保留中的本地 Node 原型，仅用于当前开发验证

当前目标架构：

- Web：React + Tiptap
- Desktop：Electron shell + remote API
- Cloud Backend：Python + FastAPI + LangChain
- 目录组织尽量复用 `full-stack-ai-agent-template`
- 观测：MVP 先使用日志，后续优先复用模板已有的 LangChain 观测扩展能力

## 本地启动

1. 复制环境变量模板：`cp .env.example .env`
2. 配置 `OPENAI_API_KEY`
3. 运行：`npm install && npm run dev`

说明：`npm run dev` 当前会启动 `frontend` 和 `prototypes/local-agent`，用于本地开发期验证 AI 交互链路。
