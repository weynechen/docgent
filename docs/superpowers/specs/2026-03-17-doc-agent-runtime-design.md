# Doc Agent Runtime 服务化设计

## 背景

当前后端已经具备：

- `Notebook` / `NotebookItem` 的基础持久化结构
- 基于 WebSocket 的 agent 交互入口
- notebook scoped / workspace scoped 的工具调用能力

但当前实现的组织方式仍然更接近“带文档上下文的聊天后端”，而不是“一个可被服务化调用的 doc agent 程序”。

本设计要解决的核心问题不是继续扩充 chat 能力，而是重新明确系统本质：

**后端应该提供一个运行在 notebook 中、真实操作目录和文件的 doc agent runtime。**

这意味着：

- agent 面对的是一个真实工作目录，而不是数据库中的文档行
- notebook 是 agent 的持久化工作空间
- item 是工作空间中的真实文件
- chat 只是向 agent 提交任务的一种输入方式，不是系统主轴
- 服务化只是在 web 上暴露这个 runtime 能力，不改变 runtime 的本质

## 目标

1. 让后端行为尽量等价于一个独立的 doc agent 程序
2. 让 agent 在真实目录中执行 `read / write / web search`
3. 让 notebook 成为可加载、可卸载、可恢复的持久化工作空间
4. 保持数据库极简，只保存服务化所需最少 metadata
5. 保持产品是单用户、单 notebook、单 runtime 的极简写作工具
6. 让前端以“提交任务 + 接收文件变更事件”的方式使用 agent，而不是把 chat 视为系统核心

## 非目标

第一版明确不做：

- 多人协作
- 多 notebook 并发 runtime 调度
- CRDT / OT / 自动 merge
- item 内容进入数据库
- 复杂 job orchestration 平台
- 通用 AI chat 平台能力
- 将 notebook 再抽象成多层资源平台

## 核心原则

### 1. 文件系统优先

文档内容的正式真相源是 notebook 目录中的真实文件，不是数据库。

### 2. runtime 优先

系统核心是 `DocAgentRuntime`，不是 `ConversationService`，也不是 CRUD API。

### 3. notebook 是工作空间，不是聊天容器

notebook 表示一个 agent 可进入、可恢复、可继续工作的目录型项目。

### 4. chat 降级为输入通道

chat、selection、按钮触发，本质上都只是向 runtime 提交任务的不同方式。

### 5. 简单优先于通用

这是单用户的极致写作工具，不为了未来协作而引入当前不需要的复杂度。

## 核心模型

### Notebook

`Notebook` 是持久化工作空间，对应一个真实目录。

数据库只记录最少信息：

- `id`
- `owner_id`
- `title`
- `root_path`
- `created_at`
- `updated_at`

### Item

`Item` 不再是核心数据库实体，而是 notebook 目录中的真实文件。

前端当前编辑哪个 item，本质上就是告诉后端一个相对路径，例如：

- `items/draft.md`
- `items/outline.md`
- `items/notes/idea.md`

### Runtime

`DocAgentRuntime` 是 notebook 的执行态实例。

它运行在 notebook 对应的真实目录上，接收任务，调用工具，读写文件，并产出事件流。

### Snapshot

runtime 可以销毁和恢复，但恢复材料不需要复杂数据库建模。第一版直接以文件形式保存：

- 当前活跃文件
- 最近任务摘要
- 最近文件变更摘要
- runtime 上下文摘要

### Task

前端每次发起 agent 请求，本质上都是 task。

第一版不强制把 task 入数据库，直接写入 runtime 日志文件即可。

## Notebook 目录结构

建议目录结构如下：

```text
/repos/notebooks/<notebook_id>/
  notebook.json
  items/
    draft.md
    outline.md
    notes/
      idea.md
  sources/
    refs.md
    article-1.url
  runtime/
    snapshot.json
    file-index.json
    task-log.jsonl
    events/
      <task_id>.jsonl
```

说明：

- `items/` 是 agent 主编辑区
- `sources/` 是参考材料区
- `runtime/` 是运行期状态、revision、任务和事件记录
- `notebook.json` 是轻量 metadata，不承载正文真相

## 极简数据库设计

数据库只保留两张核心表：

### `users`

沿用现有用户体系。

### `notebooks`

建议字段：

- `id`
- `owner_id`
- `title`
- `root_path`
- `created_at`
- `updated_at`

可选增加第三张表：

### `runtime_sessions`

只有在服务端需要快速查询当前 runtime 状态时再加。

建议字段：

- `id`
- `notebook_id`
- `status`
- `last_heartbeat_at`
- `snapshot_path`

第一版如无强需求，可以不加，直接从文件侧判断 runtime 状态。

## 服务边界

### 1. `NotebookRegistryService`

职责：

- 创建 notebook 目录骨架
- 根据 notebook id 查找根目录
- 校验 notebook 所属用户
- 提供 notebook 列表和基础 metadata

它只关心“这个 notebook 是谁的，目录在哪”。

### 2. `NotebookFSService`

职责：

- 列目录
- 读文件
- 写文件
- 创建文件
- 删除文件
- 重命名文件
- 路径安全校验

它只关心文件系统操作，不关心 agent 推理过程。

### 3. `DocAgentRuntimeService`

这是系统核心服务。

职责：

- 加载 notebook runtime
- 恢复 snapshot
- 接收任务输入
- 向 agent 注入工具能力
- 驱动 agent 在真实目录中执行
- 输出事件流
- 保存 snapshot

它应该尽量接近一个本地 doc agent 程序的心智模型。

### 4. `RuntimeLogService`

职责：

- 记录 task 输入
- 记录执行事件
- 记录文件变更
- 为恢复提供最近历史

第一版全部落文件，不强制入数据库。

## Agent 能力模型

第一版 runtime 暴露的能力保持极小集合：

- `list_files`
- `read_file`
- `write_file`
- `search_workspace`
- `read_source`
- `web_search`

其中：

- `read_file` / `write_file` 面向 `items/`
- `read_source` 面向 `sources/`
- `search_workspace` 在 notebook 根目录范围内运行
- `web_search` 是唯一外部能力

agent 不应直接操作数据库实体。

## API 设计

### HTTP API

HTTP 只负责资源管理和文件操作。

建议保留：

- `GET /api/notebooks`
- `POST /api/notebooks`
- `GET /api/notebooks/{id}`
- `GET /api/notebooks/{id}/tree`
- `GET /api/notebooks/{id}/file?path=items/draft.md`
- `PUT /api/notebooks/{id}/file`
- `POST /api/notebooks/{id}/runtime/load`
- `POST /api/notebooks/{id}/runtime/unload`
- `GET /api/notebooks/{id}/runtime`

### WebSocket API

WebSocket 只负责 agent task 执行与事件流。

建议保留单入口：

- `WS /api/ws/doc-agent`

请求体示例：

```json
{
  "notebook_id": "nb_xxx",
  "instruction": "帮我重写当前段落",
  "active_item_path": "items/draft.md",
  "selection": {
    "start": 120,
    "end": 180,
    "text": "..."
  }
}
```

要点：

- 前端提交的是任务，不是纯聊天消息
- `active_item_path` 明确当前编辑目标
- `selection` 是上下文增强，而不是独立资源

## 事件协议

后端返回的是执行事件，而不是 chat 专用事件。

建议事件类型：

- `task_accepted`
- `runtime_loaded`
- `message_delta`
- `tool_call`
- `tool_result`
- `file_changed`
- `snapshot_saved`
- `task_completed`
- `task_failed`

其中最关键的是 `file_changed`，因为 agent 的主要产出是文件修改。

示例：

```json
{
  "type": "file_changed",
  "data": {
    "path": "items/draft.md",
    "revision": 12,
    "content": "...",
    "source": "agent"
  }
}
```

前端应以 `file_changed` 作为主结果，而不是把 token 流当成主结果。

## Runtime 生命周期

为了保持简单，runtime 只保留 3 个状态：

- `unloaded`
- `loaded`
- `running`

含义：

- `unloaded`：当前 notebook 没有活跃 runtime
- `loaded`：runtime 已恢复，可接任务
- `running`：正在执行任务

运行规则：

- 一个 notebook 同时只允许一个活跃 runtime
- 一个 runtime 同时串行执行一个 task
- 空闲后可以保存 snapshot 并卸载

## 一致性与错误处理

### 真相源

真相源只有两层：

- 文档内容真相源：文件系统
- 服务 metadata 真相源：极简数据库

不引入第三套正文真相源。

### 文件写入

统一使用原子写入：

1. 写临时文件
2. fsync
3. rename 覆盖目标文件

### revision

revision 不进入数据库，统一保存在：

- `runtime/file-index.json`

建议记录：

- `path`
- `revision`
- `last_modified_at`
- `checksum`

### 并发

由于产品是单用户极简写作工具，第一版采用：

**单 notebook 单 runtime 单写入者**

这足以覆盖目标场景，也能显著降低复杂度。

### task 失败

分 3 类：

1. `input_error`
   - 路径非法
   - 文件不存在
   - selection 不合法

2. `runtime_error`
   - agent 调用失败
   - web search 失败
   - snapshot 写入失败

3. `write_conflict`
   - 文件 revision 不匹配

错误原则：

- 不损坏已有文件
- 不把 runtime 错误扩大为 notebook 内容损坏
- snapshot 损坏时允许 notebook 冷启动恢复

## 与当前架构的关系

这份设计明确否定以下中心化方向：

- 以 `chat` 为架构核心
- 以 `conversation/message` 为系统主模型
- 以数据库 `item content` 为正文真相源
- 以 `workspace` 兼容路径继续承载未来主编辑链路

这份设计明确收敛到：

- `Notebook` 是真实目录工作空间
- `DocAgentRuntime` 是系统核心
- `item` 是真实文件
- `chat` 是任务输入通道

## 落地顺序

### 阶段 1：目录模型落地

- 给 notebook 确定真实根目录
- 把 item 概念收敛为真实文件路径
- 建立 notebook 目录骨架

### 阶段 2：文件系统能力收敛

- 把现有 notebook 读写改为 `NotebookFSService`
- 让 agent 的 `read/write/search` 全部面向真实目录

### 阶段 3：runtime 化

- 把当前 WebSocket agent 改造成 task 执行入口
- 把当前 chat 语义降为 task 输入方式
- 保存 snapshot、task log、event log

### 阶段 4：兼容路径边缘化

- 把旧 `workspace` 路径降级为迁移兼容层
- 不再让其继续影响主链路设计

### 阶段 5：rewrite 并入 runtime task

- rewrite 作为 runtime 的一种任务模式保留
- 不再单独占据核心架构位置

## 结论

本设计的核心判断是：

**Docgent 后端不应继续设计为“文档 CRUD + AI chat”的组合。**

它应该被设计为：

**一个可加载、可卸载、可恢复、真实操作 notebook 目录的 doc agent runtime 服务。**

在这个前提下：

- notebook 是工作空间
- item 是文件
- agent 是执行者
- chat 是输入方式
- 数据库只是辅助服务化，不替代文件系统

这才与“docs as code”以及“独立 doc agent 程序被服务化”的目标保持一致。
