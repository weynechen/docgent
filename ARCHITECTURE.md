# Architecture Map

## 概览

当前项目是一个基于 `React + Tiptap + Zustand + Vite` 的 Docs-as-Code 写作 IDE 原型。架构目标是把“编辑器体验”“AI 改写”“文档存储”“版本快照”分离，避免未来接入 Electron、本地文件系统或真实模型时发生强耦合。

## 分层

### 应用层

- `src/app/App.tsx`
  - 负责工作台布局、侧栏折叠/拖拽、标签栏、状态栏和跨区域交互编排。
- `src/app/store.ts`
  - 负责工作区状态、AI 建议状态、版本列表、通知与文档保存。

### 领域层

- `src/documents/`
  - `documentStore.ts`：文档读取/保存接口与 mock 实现
  - `versionStore.ts`：版本快照接口与 localStorage 实现
- `src/ai/`
  - `provider.ts`：前端 AI provider，负责启动改写请求并订阅 SSE 事件
- `server/`
  - `index.ts`：本地 Node agent 服务，对前端暴露 `/api/ai/rewrite`
  - `rewrite-agent.ts`：基于 `@mariozechner/pi-ai` 的选区改写 agent

### 表达层

- `src/shared/`
  - `markdown.ts`：Markdown 与编辑器内容的转换
  - `types.ts`：领域实体、改写流事件与版本定义
  - `storage.ts`：浏览器持久化辅助
  - `diff.ts`：差异预览逻辑

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
- AI 改写已切换为本地 agent 服务，但仍只覆盖单一“选区改写”能力
- 右栏 AI 面板与编辑器模板是集成关系，不是统一插件系统

## 后续演进

1. 将 `DocumentStore` 替换为本地目录与 Markdown 文件读写实现。
2. 将 `VersionStore` 从浏览器快照升级为 Git 或兼容型版本存储。
3. 将 AI provider 抽象扩展为真实模型网关与多 provider 适配。
4. 把编辑器 UI 定制从模板级覆盖收敛为可维护的主题层与能力层。
