# Backend

该目录对齐 `full-stack-ai-agent-template` 的主后端思路，作为长期云端服务主线。

目标职责：

- 使用 Python 作为后端主技术栈
- 采用 FastAPI 作为 API 入口
- 在单个 backend 内按 `api / services / repos / agents / core` 分层
- Agent 运行框架改为 LangChain，以复用模板现有能力
- MVP 阶段使用日志做基础观测
- 后续优先复用模板已有的 LangChain 集成与观测扩展点，而不是自建一套 agent 基础设施

建议子目录职责：

- `app/api`：HTTP / WebSocket 路由
- `app/services`：业务编排与应用服务
- `app/repos`：数据库访问层
- `app/agents`：LangChain agents、chains、tools
- `app/core`：配置、鉴权、基础依赖

当前仓库尚未开始 Python backend 实现，目录先作为目标结构占位。
