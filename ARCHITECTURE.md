# Architecture Map

## 概览

当前项目已从“单前端原型”进入“前端 + 模板化 backend”的阶段。后端已经基于 `fastapi-fullstack` / `full-stack-ai-agent-template` 生成并融合到当前仓库，同时保留本项目自己的 React/Tiptap 前端与桌面策略。

目标架构是：

- `frontend`：React + Tiptap 写作前端
- `desktop`：Electron 桌面壳，连接远端 API
- `backend`：Python 主后端，采用模板推荐的单 backend 分层

在目标架构中，AI 运行框架改为 `LangChain`，优先复用模板已有能力，不再以 OpenAI Agents 作为主线。

当前仓库的 AI 主线已经切换到 `backend` 中的 Python FastAPI + LangChain 实现。

当前主编辑链路已经切到 notebook-first：`Notebook` 作为顶层集合，`draft` / `note` 作为 item，右侧 AI 面板也已绑定 notebook/item 上下文。

## 分层

### 前端工作区

- `frontend/src/app/App.tsx`
  - 负责 notebook 工作台布局、侧栏折叠/拖拽、状态栏、冲突横幅和右栏 AI 编排。
- `frontend/src/notebooks/store.ts`
  - 负责 notebook/item 状态、自动保存、离线缓冲、冲突恢复、AI 会话状态与写回同步。

### 前端领域与表达层

- `frontend/src/notebooks/`
  - `remoteNotebookStore.ts`：notebook/item/source 远端接口
  - `indexedDb.ts`：本地待同步编辑缓冲
  - `syncEngine.ts`：debounce、离线重放与冲突状态机
  - `NotebookConflictBanner.tsx`：冲突恢复横幅
  - `NotebookSidebar.tsx`：notebook items 与 sources 双分区侧栏
- `frontend/src/ai/`
  - `provider.ts`：前端 AI provider，负责启动 notebook-aware chat 请求并订阅 WebSocket 事件
- `frontend/src/shared/`
  - `markdown.ts`：Markdown 与编辑器内容的转换
  - `types.ts`：共享消息事件与前端领域类型

### 云端后端目录

- `backend/app/api`
  - FastAPI 路由、依赖注入、异常处理与版本化入口
- `backend/app/services`
  - 负责认证、用户、会话、workspace、rewrite run、agent run 等应用服务
- `backend/app/repositories`
  - 负责数据库访问
- `backend/app/agents`
  - 负责 LangChain agents、prompts、tools 与模型调用
- `backend/app/core`
  - 负责配置、鉴权、依赖注入与基础能力
- `backend/app/db`
  - 负责数据库 session 与模型
- `backend/cli`
  - 模板生成的 Django 风格管理命令入口

该结构直接复用模板生成的主后端实现，而不是手工模仿模板目录。

### 已落地 notebook 路径

- `backend/app/api/routes/v1/notebooks.py`
  - 提供 notebook、notebook item 与 notebook source 的创建、读取和更新接口
- `backend/app/services/notebook.py`
  - 负责 notebook/item/source 生命周期与 revision 冲突校验
- `backend/app/agents/tools/notebook_tools.py`
  - 提供 notebook scoped 的 `ListItems` / `Read` / `Write` / `WebSearch`
- `backend/app/api/routes/v1/agent.py`
  - 同时兼容旧 workspace 语义与新 notebook/item 语义，并在写回时发出 `notebook_item_updated`

### 仍保留的旧路径

- `backend/app/api/routes/v1/workspaces.py`
  - 仍承载旧的临时 workspace 与 rewrite 流程，主要作为兼容路径保留
- `backend/app/services/workspace.py`
  - 仍负责会话级临时工作区文件树与读写
- `backend/app/services/rewrite.py`
  - 仍负责 reviewable rewrite run

### 当前 AI 路径状态

- 右栏 AI Chat 已是会话式 agent endpoint
- agent runtime 已接 notebook-scoped tools，旧 workspace tools 仍保留兼容
- 事件流已包含消息增量、工具调用、工具结果、notebook item 写回与最终完成态

### 编辑器 UI 层

- `@/components/tiptap-templates/simple/`
  - 官方 `simple-editor` 模板的本地源码副本
- `@/components/tiptap-ui-*`
  - 工具条、按钮、弹层等编辑器原子组件
- `@/components/tiptap-node/`
  - 标题、列表、分割线、图片上传等节点样式与扩展

## 当前边界

- notebook 数据库域已是正式真相源；旧临时 workspace 仍存在，但不再是主编辑路径
- notebook sources 当前仍是 metadata lane：external link 已落地，imported file 还没有真实文件存储与提取
- 版本系统是应用内快照，不是 Git
- 当前 AI 改写与 notebook chat 都已切到模板化 Python backend；仍未接入持久化任务队列
- 冲突恢复已具备基础 UX，但还没有更复杂的 diff / merge 辅助
- 右栏 AI 面板与编辑器模板是集成关系，不是统一插件系统
- `desktop` 仍是目标目录，占位多于实现

## 后续演进

1. 为 notebook source 补齐 imported file 的真实上传、存储和提取流程。
2. 为冲突恢复补充浏览器级回归、差异预览和更细粒度状态反馈。
3. 将 rewrite run / agent run 从内存态扩展到可持久化或可恢复的任务模型。
4. 在模板后端中继续接入文档、版本与用户域能力，而不是额外再迁一次模板。
5. MVP 阶段继续使用日志观测，后续优先接模板现有的 LangChain 观测扩展点。
6. 在 `desktop` 中实现仅连接远端 API 的桌面壳。
