# Architecture Map

## 概览

当前项目已从“单前端原型”进入“前端 + 云端 backend 目标架构”的阶段。目标方向对齐 `full-stack-ai-agent-template` 的分层思路，但保留本项目自己的 React/Tiptap 前端与桌面策略。

目标架构是：

- `frontend`：React + Tiptap 写作前端
- `desktop`：Electron 桌面壳，连接远端 API
- `backend`：Python 主后端，采用模板推荐的单 backend 分层

在目标架构中，AI 运行框架改为 `LangChain`，优先复用模板已有能力，不再以 OpenAI Agents 作为主线。

当前仓库仍保留一个本地 Node AI 原型，供开发阶段验证交互链路，但它不再代表长期服务端方向。

## 分层

### 前端工作区

- `frontend/src/app/App.tsx`
  - 负责工作台布局、侧栏折叠/拖拽、标签栏、状态栏和跨区域交互编排。
- `frontend/src/app/store.ts`
  - 负责工作区状态、AI 建议状态、版本列表、通知与文档保存。

### 前端领域与表达层

- `frontend/src/documents/`
  - `documentStore.ts`：文档读取/保存接口与 mock 实现
  - `versionStore.ts`：版本快照接口与 localStorage 实现
- `frontend/src/ai/`
  - `provider.ts`：前端 AI provider，负责启动改写请求并订阅 SSE 事件
- `frontend/src/shared/`
  - `markdown.ts`：Markdown 与编辑器内容的转换
  - `types.ts`：领域实体、改写流事件与版本定义
  - `storage.ts`：浏览器持久化辅助
  - `diff.ts`：差异预览逻辑

### 云端后端目标目录

- `backend/app/api`
  - 预留给 FastAPI 路由与流式接口
- `backend/app/services`
  - 负责认证、用户、文档、版本、任务编排等应用服务
- `backend/app/repos`
  - 负责数据库访问
- `backend/app/agents`
  - 负责 LangChain agents、chains、tools 与模型调用
- `backend/app/core`
  - 负责配置、鉴权、依赖注入与基础能力

该结构优先复用 `full-stack-ai-agent-template` 的已有能力，而不是在当前仓库重新设计一套 agent 基础设施。

### 过渡原型目录

- `prototypes/local-agent/server/`
  - 当前开发期使用的本地 Node rewrite 原型
  - 仅作为过渡验证实现，不是长期主线

### 编辑器 UI 层

- `@/components/tiptap-templates/simple/`
  - 官方 `simple-editor` 模板的本地源码副本
- `@/components/tiptap-ui-*`
  - 工具条、按钮、弹层等编辑器原子组件
- `@/components/tiptap-node/`
  - 标题、列表、分割线、图片上传等节点样式与扩展

## 当前边界

- 文档存储仍是 mock/in-memory，不是本地文件系统
- 版本系统是应用内快照，不是 Git
- 当前 AI 改写仍依赖本地 Node 原型服务，不代表长期云端实现
- 右栏 AI 面板与编辑器模板是集成关系，不是统一插件系统
- `backend` 与 `desktop` 目前还是目标目录，占位多于实现

## 后续演进

1. 将当前本地 Node AI 原型替换为 `backend` 中的 Python LangChain 实现。
2. 在 `backend` 内部落地模板式分层，而不是过早拆微服务。
3. MVP 阶段使用日志观测，后续优先接模板现有的 LangChain 观测扩展点。
4. 在 `desktop` 中实现仅连接远端 API 的桌面壳。
