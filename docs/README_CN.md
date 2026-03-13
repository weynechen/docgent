# Writing IDE MVP

这是一个以 `frontend` 为当前写作工作区、并已将 `backend` 全量迁移到 `fastapi-fullstack` / `full-stack-ai-agent-template` 结构的 Docs-as-Code AI 写作 IDE 仓库。

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
- `backend`：已落地的 Python FastAPI 后端，按模板方式分层
- `nginx` / `docker-compose*.yml` / `Makefile`：模板对齐后的运维与开发资产

当前目标架构：

- Web：React + Tiptap
- Desktop：Electron shell + remote API
- Cloud Backend：Python + FastAPI + LangChain
- 后端目录与运行方式直接复用模板生成结果并做项目内融合
- 观测：MVP 先使用日志，后续优先复用模板已有的 LangChain 观测扩展能力

当前产品主线已经从“右侧单次选区改写面板”升级为“右侧 AI Chat + agent 自主编辑能力”，目前已经具备以下基础能力：

- 回车发送，`Shift+Enter` 换行
- 多轮对话与消息历史
- assistant 消息流式更新
- 无选区也可执行任务
- 基于 workspace 的 `Read`、`Write`、`Glob`、`Grep`、`WebSearch` 工具
- agent 自主循环与可观察执行步骤

## 本地启动

1. 复制环境变量模板：`cp .env.example .env`
2. 配置 `OPENAI_API_KEY`
3. 仅启动前端：`npm install && npm run dev`
4. 同时启动前后端：`make run`

说明：`npm run dev` 当前只启动前端；`make run` 会同时启动 `frontend` 和模板化的 Python backend。现有 AI 选区改写已切换到 `/api/v1/ai/rewrite/*`，右侧 agentic chat 当前使用 `/api/v1/ws/agent`。

## 新机器迁移启动

推荐在一台全新的机器上按下面顺序拉起环境：

1. 安装 Node.js、`uv`、Docker
2. 执行 `npm install`
3. 执行 `make install`
4. 执行 `cp .env.example .env`
5. 在 `.env` 中填写 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`
6. 执行 `make docker-db`
7. 执行 `make db-upgrade`
8. 执行 `make run`

数据库注意事项：

- 本项目的 Docker PostgreSQL 默认映射到宿主机 `5433`
- 根目录 `.env.example` 已默认使用 `5433`，用于本地 `make run`
- 如果你的机器已经有本地 PostgreSQL 占用了 `5432`，保持当前配置即可，不需要改 Docker 映射
- 如果你不使用 Docker 数据库，而是直接连接本机已有 PostgreSQL，请手动修改 `.env` 里的 `POSTGRES_*`
- `backend/.env.example` 里的 `5432` 是给容器内 `app -> db` 通信用的内部端口，不是宿主机端口

推荐启动后自检：

- 执行 `make db-current`
- 打开 `http://localhost:5173`
- 在右侧 AI Chat 发送一条消息
- 如遇报错，优先查看 `logs/latest/app.log` 和 `logs/latest/error.log`

后端日志默认写到仓库根目录 `logs/`。每次后端启动都会创建新的 `logs/runs/<timestamp-pid>/` 目录，并维护 `logs/latest` 指向最新一次启动，便于只查看当前会话日志。
