# Notebook 与 Item 双击重命名设计

## 背景

当前 notebook-first 主链路已经支持：

- notebook 创建与列表展示
- draft / note item 创建与切换
- item 内容自动保存、离线缓冲与冲突恢复

但左侧栏的 notebook 和 item 仍然只有查看与切换能力，缺少最基本的重命名交互。对写作类产品而言，这会直接影响资料整理效率，也会让 `Untitled notebook` / `Untitled` 长期残留在工作区中。

## 目标

1. notebook 支持双击名称后直接重命名
2. item 支持双击名称后直接重命名
3. notebook 名称在产品语义上对应“文件夹名”
4. item 名称在产品语义上对应“文件名”
5. 重命名成功后立即反映到左侧栏与当前激活状态
6. 不破坏现有正文自动保存、离线缓冲与冲突恢复链路

## 非目标

第一版明确不做：

- 真实本地文件系统目录与文件重命名
- notebook / item 独立 slug、path 或导出文件名字段
- 批量重命名
- 重命名历史
- sources 的重命名

## 设计边界

当前正式真相源是数据库中的 `Notebook.title` 与 `NotebookItem.title`，而不是磁盘路径。

因此本次“名称对应文件夹名和文件名”的落地方式为：

- `notebook.title` 作为文件夹名语义
- `item.title` 作为文件名语义

这比现在额外引入一个尚无消费方的 path/slug 字段更合理，也能避免前端显示名称与后端正式名称不一致。

后续若产品重新接入真实文件系统，再在此语义之上补充派生路径规则。

## 交互设计

### 触发方式

- 双击 notebook 卡片标题，进入 inline 编辑状态
- 双击 item 列表标题，进入 inline 编辑状态

### 编辑态行为

- 编辑态下将标题替换为单行输入框
- 保留当前选中项的视觉高亮，不因进入编辑态而丢失上下文
- 输入框自动聚焦并默认选中文本，方便直接覆盖

### 提交与取消

- `Enter`：提交
- `blur`：提交
- `Esc`：取消并恢复原名称

### 内容规则

- 提交前执行 `trim()`
- 空字符串不保存，直接回退为原名称
- 第一版不额外做字符白名单限制，沿用现有后端长度约束

## 数据与状态设计

### 后端

当前 item 已经支持通过 `PATCH /api/v1/notebooks/items/{id}` 更新 `title`，notebook 还没有对应 rename 接口。

本次补充：

- `PATCH /api/v1/notebooks/{id}`

请求体只允许更新：

- `title`

### 前端远端访问层

在 `remoteNotebookStore` 中补充：

- `updateNotebook({ notebookId, title })`

继续复用现有 `updateItem({ itemId, title, baseRevision })` 更新 item 名称。

### 前端 store

在 notebook store 中补充两个显式动作：

- `renameNotebook(notebookId, title)`
- `renameItem(itemId, title)`

处理原则：

- notebook rename 成功后，更新 `notebooks` 与 `activeNotebook`
- item rename 成功后，更新 `activeNotebook.items`、`activeItem` 与 `notebooks`
- rename 不进入正文 outbox，不走自动保存 debounce
- rename 失败时回退显示值，并向用户提示错误

## 与现有同步模型的关系

正文编辑与名称编辑应分开处理。

原因：

1. 名称更新是显式 metadata 变更，不是持续正文输入
2. 当前 outbox / conflict 机制是围绕正文 revision 设计的，直接复用会增加状态复杂度
3. 双击改名需要立即提交和明确失败反馈，而不是沉入后台同步

因此本次 rename 采用单次请求模型。

### item revision 语义

item 改名默认不递增 `serverRevision`，保持当前语义：

- `content` 变化时递增 revision
- `title` 单独变化时不递增 revision

这样可以避免因为侧栏改名导致正文编辑链路误判冲突。

## 错误处理

### notebook rename 失败

- 回退到旧名称
- 弹出轻量错误提示

### item rename 失败

- 回退到旧名称
- 若后端返回 `REVISION_CONFLICT`，同样不进入正文冲突恢复横幅
- 第一版直接使用错误提示，让用户重试

这是因为标题改名不是高价值长文本内容，不需要进入复杂恢复流程。

## 测试策略

### 后端

补充 notebook rename 的：

- service 测试
- API 路由测试

覆盖：

- 成功更新标题
- notebook 不存在时返回 404

### 前端状态层

补充 store 测试：

- `renameNotebook` 成功后更新 `activeNotebook` 与列表
- `renameItem` 成功后更新 `activeItem` 与当前 notebook items

### 前端组件层

补充 sidebar 交互测试：

- 双击 notebook 标题进入编辑态
- 双击 item 标题进入编辑态
- `Enter` 提交
- `Esc` 取消
- `blur` 提交
- 空名称回退

## 对现有文档的影响

这次设计不会改变 notebook-first 的正式数据模型，只是为该模型补齐基础元数据编辑能力。

因此：

- 不需要修改产品核心范围
- 需要在实现后更新相关设计索引与质量记录
- 若后续接入真实文件系统，应明确把“显示名”和“文件系统路径名”是否解耦写入新设计文档
