# Architecture Map

## 概览

当前项目已从“单前端原型”进入“前端 + 模板化 backend”的阶段。后端已经基于 `fastapi-fullstack` / `full-stack-ai-agent-template` 生成并融合到当前仓库，同时保留本项目自己的 React/Tiptap 前端与桌面策略。

目标架构是：

- `frontend`：React + Tiptap 写作前端
- `desktop`：Electron 桌面壳，连接远端 API
- `backend`：Python 主后端，采用模板推荐的单 backend 分层

在目标架构中，AI 运行框架改为 `LangChain`，优先复用模板已有能力，不再以 OpenAI Agents 作为主线。

当前仓库的 AI 主线已经切换到 `backend` 中的 Python FastAPI + LangChain 实现。

## 分层

### 前端工作区

- `frontend/src/app/App.tsx`
  - 负责工作台布局、侧栏折叠/拖拽、标签栏、状态栏和跨区域交互编排。
- `frontend/src/app/store.ts`
  - 负责远程工作区状态、AI 候选状态、版本列表、通知与整文保存。

### 前端领域与表达层

- `frontend/src/documents/`
  - `documentStore.ts`：后端工作区文档读取/保存接口
  - `versionStore.ts`：版本快照接口与 localStorage 实现
- `frontend/src/ai/`
  - `provider.ts`：前端 AI provider，负责启动改写请求并订阅 SSE 事件
- `frontend/src/shared/`
  - `markdown.ts`：Markdown 与编辑器内容的转换
  - `types.ts`：领域实体、改写流事件与版本定义
  - `storage.ts`：浏览器持久化辅助
  - `diff.ts`：差异预览逻辑

### 云端后端目录

- `backend/app/api`
  - FastAPI 路由、依赖注入、异常处理与版本化入口
- `backend/app/services`
  - 负责认证、用户、会话、workspace、rewrite run 等应用服务
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

### 已落地 AI 路径

- `backend/app/api/routes/v1/workspaces.py`
  - 提供工作区创建、文件读取/保存、AI 改写 run、候选应用与 SSE 接口
- `backend/app/services/workspace.py`
  - 负责临时工作区文件树、revision 与文件读写
- `backend/app/services/rewrite.py`
  - 负责 run 注册、事件回放、候选变更与应用
- `backend/app/agents/rewrite.py`
  - 负责基于完整 Markdown 文档生成 reviewable candidate

### 编辑器 UI 层

- `@/components/tiptap-templates/simple/`
  - 官方 `simple-editor` 模板的本地源码副本
- `@/components/tiptap-ui-*`
  - 工具条、按钮、弹层等编辑器原子组件
- `@/components/tiptap-node/`
  - 标题、列表、分割线、图片上传等节点样式与扩展

## 当前边界

- 临时工作区是后端真相源，但仍是会话级临时目录，不是正式持久化存储
- 版本系统是应用内快照，不是 Git
- 当前 AI 改写已切换到模板化 Python backend；仍未接入持久化任务队列
- 右栏 AI 面板与编辑器模板是集成关系，不是统一插件系统
- `desktop` 仍是目标目录，占位多于实现

## 后续演进

1. 将 rewrite run 从内存态扩展到可持久化或可恢复的任务模型。
2. 在模板后端中继续接入文档、版本与用户域能力，而不是额外再迁一次模板。
3. MVP 阶段继续使用日志观测，后续优先接模板现有的 LangChain 观测扩展点。
4. 在 `desktop` 中实现仅连接远端 API 的桌面壳。
