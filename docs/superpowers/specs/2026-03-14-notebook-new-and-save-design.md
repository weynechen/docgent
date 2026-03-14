# Notebook 新建与保存设计

## 背景

当前产品已经具备基础编辑和 AI 协作编辑能力，但仍缺少笔记软件级别的核心体验：

- 新建一个可持续写作的工作单元
- 在不打断输入的前提下可靠保存
- 在异常断开或断网时尽量不丢失内容

现有系统仍以临时 `workspace/file` 为主，后端工作区是会话级真相源，适合 MVP 阶段的单文档编辑，但不足以承载“围绕一个主题聚合多篇草稿和资料笔记”的写作流程。

## 目标

1. 把产品的核心写作单元从单篇文档提升为 `Notebook`
2. `New` 创建 notebook 时自动附带一个可立即写作的初始 draft
3. 默认采用自动保存，不依赖显式 `Save` 按钮
4. 以后端数据库作为正式真相源，同时通过前端本地缓冲实现低延时与断网不丢
5. 第一版支持 notebook 内多篇 `draft` 与文本型 `note`
6. 为未来扩展 `external_link` 和 `imported_file` 预留模型空间

## 非目标

第一版明确不做以下能力：

- 多人实时协同编辑
- 自动三方内容合并
- 外链与本地文件导入的正式落地
- 本地文件系统作为正式真相源
- 跨 notebook 的引用关系管理
- 复杂权限系统

## 核心决策

### 1. 顶层工作单元采用 Notebook

产品对外名称使用 `Notebook`，中文文案使用“笔记本”。

原因：

- 比 `Document` 更符合“围绕一个主题组织多篇草稿和材料”的写作过程
- 比 `Project` 更轻，不会过早引入工程管理语义
- 与后续 AI 读取上下文、检索资料、生成多份草稿的方向天然匹配

### 2. New 的默认行为

用户点击 `New` 时：

1. 前端请求后端创建 notebook
2. 后端立即创建 notebook，并自动生成一个空白 `draft`
3. 前端打开这篇初始 draft，让用户直接开始输入

默认命名建议：

- notebook：`Untitled notebook`
- 初始 draft：`Untitled`

此流程避免向导式创建，保证“点新建后立刻可写”。

### 3. 保存默认采用自动保存

第一版不强调手动 `Save` 按钮，而是采用自动保存 + 状态提示：

- `Saving...`
- `Saved`
- `Offline changes`
- `Sync failed`
- `Conflict`

保存状态沿用现有底部状态栏，避免遮挡正文和中断输入。

## 领域模型

### Notebook

顶层聚合对象，至少包含：

- `id`
- `title`
- `createdAt`
- `updatedAt`
- `syncState`

### NotebookItem

notebook 内统一的子对象抽象，第一版使用 `type` 区分具体形态。

第一版支持：

- `draft`
- `note`

预留扩展：

- `external_link`
- `imported_file`

通用字段建议：

- `id`
- `notebookId`
- `type`
- `title`
- `order`
- `serverRevision`
- `createdAt`
- `updatedAt`
- `lastEditedAt`

### Draft

`NotebookItem(type=draft)` 的内容形态。

- 允许一个 notebook 内存在多篇 draft
- 各 draft 平级存在，不强制设置 `main draft`
- 主要字段：
  - `content`
  - `contentFormat`，第一版固定为 `markdown`

### Note

`NotebookItem(type=note)` 的内容形态。

- 用于文本型笔记、摘录、想法
- 主要字段：
  - `content`
  - `contentFormat`，第一版固定为 `markdown`

第一版约定以 `markdown` 作为服务端真相格式。

原因：

- 与现有后端读取、AI 改写和版本对比链路更一致
- 迁移成本低于把正式持久化切到 `tiptap_json`
- 后续若需要富文本真相格式，可在不推翻 notebook 模型的前提下单独演进

## 保存与同步模型

保存拆分为三层：

### 1. 编辑缓冲层

用户输入首先写入前端内存态，保证输入过程零阻塞。

### 2. 本地持久化层

前端将未同步变更按 notebook 粒度写入本地持久化缓冲，用于应对：

- 页面刷新
- 浏览器崩溃
- 短时断网
- 后端瞬时不可用

建议前端维护：

- `pendingChanges`
- `syncQueue`
- `offlineState`

第一版本地持久化介质建议使用 `IndexedDB`，而不是继续沿用轻量 `localStorage`：

- 更适合较长正文与多 item notebook
- 不容易碰到容量瓶颈
- 可为后续 outbox、恢复记录和同步元数据提供更稳定的结构化存储

### 3. 远端真相层

后端数据库是正式真相源。

前端在后台将本地变更异步推送到后端，成功后清理对应缓冲并更新同步状态。

## 自动保存策略

第一版不采用“每次输入都立刻请求后端”的极端模式，而使用轻量批处理：

- 用户停止输入后，经 500ms 到 1500ms 的 debounce 触发同步
- 切换 item、窗口失焦、页面关闭前执行一次 flush
- 离线时暂停远端写入，仅保留本地缓冲

设计原则：

- 低延时由本地写入保证
- 可靠持久化由本地缓冲 + 后端数据库共同保证
- 用户只理解状态，不需要理解实现细节

## 离线与恢复策略

第一版采用“断网可继续编辑”的策略。

离线时：

- 当前 item 状态显示为 `Offline changes`
- 用户可以继续编辑
- 本地缓冲持续累积未同步变更

网络恢复时：

- 后台自动按顺序重放待同步变更
- 全部成功后状态回到 `Saved`
- 任一步骤失败则转为 `Sync failed` 或 `Conflict`

## 冲突处理策略

第一版明确采用 `single-active-client per notebook` 作为目标使用路径，不追求多端并发协同。

每个 item 保存时附带 `serverRevision`：

- 若服务端 revision 匹配，写入成功并返回新的 revision
- 若 revision 过旧，服务端拒绝写入，前端将该 item 标记为 `Conflict`

### 冲突时的处理原则

- 不静默覆盖服务端内容
- 不丢弃本地未同步内容
- 暂停该 item 的自动上推，等待用户处理

### 第一版提供的恢复动作

1. `Keep local as new copy`
   - 将本地未同步内容另存为 notebook 内一个新的 draft 或 note
2. `Reload server version`
   - 放弃本地未同步内容并重新加载服务端版本
   - 执行前必须显式提示，因为这是可能丢失本地改动的动作

第一版不做自动三方合并，原因如下：

- 富文本与 AI 写回场景下自动合并正确性难以保证
- 错误自动合并的风险高于显式冲突提示
- 只要本地内容不丢失，第一版的可靠性目标已经成立

## 前后端落地方式

### 后端

现有 `workspace/file` 模型更适合临时工作区，不应继续承担正式 notebook 持久化角色。

建议新增 notebook 域：

- `NotebookService`
- `NotebookRepository`
- 由 `NotebookService` 统一管理 notebook 与 item 生命周期

第一版后端 API 至少应包含：

- `POST /notebooks`
- `GET /notebooks`
- `GET /notebooks/{id}`
- `POST /notebooks/{id}/items`
- `PATCH /items/{id}`

响应中应携带足够的同步字段，例如：

- `serverRevision`
- `updatedAt`
- `syncState`

### 前端

当前 store 仍以 `activeDoc` 为核心，需提升为 notebook/item 模型。

建议新增或重构的状态：

- `activeNotebook`
- `activeItem`
- `pendingChanges`
- `syncQueue`
- `offlineState`
- `syncStatusByItem`

UI 层变化：

- 左栏从“文档列表”扩展为 notebook 列表与当前 notebook 的 item 列表
- 中栏继续编辑当前 active item
- 底部状态栏显示保存与同步状态

当前显式 `saveActiveDoc()` 可以保留为内部 flush 能力，但不应再作为主要用户交互。

## 与 AI 协作的关系

notebook 作为顶层聚合对象后，AI 将获得更清晰的上下文边界：

- 当前 active item 仍是默认写入目标
- AI 可在 notebook 范围内读取其他 text item 作为上下文
- 第一版不要求 AI 自动跨多个 draft 进行复杂重组

这保证了 notebook 设计既服务于手工写作，也为后续 agentic workflow 预留了空间。

## 迁移思路

第一版应避免一次性推翻现有编辑流程，建议采用渐进迁移：

1. 建立正式 notebook/item 数据模型与 API
2. 前端 store 从 `doc` 模型切换到 `notebook/item`
3. 自动保存与本地缓冲先在当前 active item 打通
4. 再把左栏导航和 AI 上下文切换到 notebook 视角
5. 最后逐步弱化旧 `workspace/file` 在主编辑路径中的角色

## 验收标准

以下行为应视为第一版完成的最低标准：

1. 用户可创建一个 notebook，并立即进入初始 draft 的编辑态
2. notebook 内支持多篇 draft 与文本型 note
3. 用户输入后可自动保存，无需显式点击保存
4. 断网后仍可继续编辑，且本地改动不会因刷新而丢失
5. 恢复网络后可自动补同步
6. revision 冲突出现时，不会静默覆盖本地内容
7. 保存状态全程可见，但不打断写作

## 测试重点

### 前端状态与交互

- 新建 notebook 后是否自动打开初始 draft
- 输入后状态是否按预期从 `Saving...` 进入 `Saved`
- 离线时状态是否切换为 `Offline changes`
- 恢复后是否自动回到 `Saved`

### 本地缓冲可靠性

- 编辑后刷新页面，未同步内容是否可恢复
- 浏览器短暂离线后是否继续记录修改

### 后端一致性

- item 更新是否正确校验 `serverRevision`
- 过期 revision 是否稳定返回冲突错误

### 冲突保护

- 冲突发生时，本地内容是否仍保留
- `Keep local as new copy` 是否生成新 item
- `Reload server version` 是否正确清空本地冲突态

## 开放问题

以下问题不影响第一版设计成立，但需要在实施计划中细化：

- notebook 列表是否需要最近访问排序与搜索
- `note` 与 `draft` 在 UI 上是否需要不同编辑器能力裁剪
