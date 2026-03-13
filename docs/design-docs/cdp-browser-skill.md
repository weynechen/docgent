# CDP 浏览器技能接入方案

## 目标

把 Chrome DevTools Protocol（CDP）接入现有 agent runtime，形成一组受控的浏览器工具，使 Codex 可以：

- 导航到目标页面并等待稳定态
- 采集结构化 DOM 快照，而不是只依赖截图
- 生成屏幕截图用于视觉核对
- 在一次 agent run 内复现前端错误、验证修复，并基于页面状态推理 UI 行为

该能力应作为现有 workspace tools 的补充层，而不是把浏览器自动化逻辑直接写进 prompt。

## 为什么要单独做成技能

CDP 接入既包含运行时代码，也包含一套稳定工作流：

- 先启动或连接浏览器会话
- 再导航、等待、采样 DOM / 截图
- 再把结构化结果回传给 agent
- 必要时执行交互、重试和断言

这套流程有明显的程序性和边界约束，适合作为技能封装，避免每次任务都重新发明浏览器控制方式。

## 建议分层

沿用当前仓库“agent runtime + tools”的方向，把能力拆成四层：

1. `CDP session adapter`
   - 负责启动 Chrome 或连接已有远程调试端口
   - 负责维护 `browser_session_id`、tab、target 和生命周期
2. `browser service`
   - 对 CDP 原始命令做薄封装，如 `Page.navigate`、`DOMSnapshot.captureSnapshot`、`Page.captureScreenshot`
   - 负责等待策略、超时、重试和错误归一化
3. `agent tools`
   - 向 LangChain runtime 暴露高层工具，如 `BrowserNavigate`、`BrowserSnapshot`、`BrowserScreenshot`
   - 工具输出必须是面向 LLM 的摘要化结构，不能直接倾倒原始协议数据
4. `codex skill`
   - 规定何时使用浏览器工具、如何选择快照还是截图、如何复现 bug、如何验证修复

## 运行时接线

建议在后端新增一组与 workspace tools 平级的 browser tools。

参考挂载点：

- `backend/app/services/browser/`
  - `session.py`：浏览器会话管理
  - `cdp_client.py`：CDP 连接与基础命令
  - `page_ops.py`：导航、等待、点击、输入、截图、快照
- `backend/app/agents/tools/browser.py`
  - LangChain tools 定义
- `backend/app/agents/runtime/`
  - 在现有 agent loop 中注册 browser tools

如果当前 runtime 还没有独立的 tool registry，也应优先补一个统一注册点，再接 CDP，避免浏览器工具散落在 route 或 service 中。

## 最小工具集

第一版不要直接暴露完整 CDP，而应提供少量高价值高稳定度工具。

### 1. `BrowserNavigate`

输入：

- `session_id`
- `url`
- `wait_until`：`domcontentloaded | load | networkidle | selector`
- `timeout_ms`
- 可选 `wait_selector`

输出：

- 最终 URL
- 页面标题
- 加载耗时
- 是否到达稳定态
- 关键错误摘要

### 2. `BrowserSnapshot`

输入：

- `session_id`
- `selector` 或 `root=document`
- `include_text`
- `include_bounds`
- `max_nodes`

输出：

- 页面语义树摘要
- 可见文本块
- 关键控件列表
- 交互元素列表
- 选区或目标节点的层级路径

建议优先返回压缩后的结构化 JSON，例如：

```json
{
  "url": "http://localhost:3000/settings",
  "title": "Settings",
  "visible_text": ["Profile", "Save", "Email is required"],
  "controls": [
    {"role": "textbox", "name": "Email", "selector": "#email"},
    {"role": "button", "name": "Save", "selector": "button[type=submit]"}
  ],
  "alerts": [
    {"text": "Email is required", "selector": ".error-message"}
  ]
}
```

不要把完整 DOM、全部样式和大块 HTML 原样塞给模型。

### 3. `BrowserScreenshot`

输入：

- `session_id`
- `full_page`
- 可选 `selector`
- `viewport`

输出：

- 截图文件路径或对象存储引用
- 截图尺寸
- 截图时间
- 可选视觉摘要

截图主要用于：

- 验证布局是否符合预期
- 和 DOM 快照交叉核对
- 给人类开发者留证据

### 4. `BrowserInteract`

输入：

- `session_id`
- `action`：`click | type | press | hover | select`
- `selector`
- 可选 `value`

输出：

- 实际执行动作
- 命中的元素摘要
- 动作后页面变化摘要

### 5. `BrowserEvaluateAssertion`

输入：

- `session_id`
- `assertion`
- 可选 `selector`

输出：

- `passed`
- 断言说明
- 支撑证据

该工具不是让模型执行任意 JS，而是执行白名单断言，例如：

- 元素存在
- 元素可见
- 文本包含
- 按钮 disabled / enabled
- URL 匹配

## DOM 快照与截图的职责分离

要让模型真正“理解 UI 行为”，不能只给截图，也不能只给 DOM。

- DOM 快照适合回答：
  - 哪些元素存在
  - 表单状态是什么
  - 哪个错误消息出现了
  - 页面交互路径是否正确
- 截图适合回答：
  - 布局是否错位
  - 元素是否遮挡
  - 样式是否丢失
  - 可视层级是否异常

推荐默认策略：

1. 先导航
2. 先取 DOM 快照
3. 若任务涉及视觉或布局，再补截图
4. 若需要复现交互，再执行 `BrowserInteract`
5. 最后用断言工具验证修复

## 让 Agent 能复现错误

把“复现 bug”建模为显式工作流，而不是一句模糊提示。

建议技能内要求 Codex 遵循：

1. 读取用户给出的复现路径、页面 URL、账号前提和期望行为
2. 启动或复用浏览器会话
3. 导航到目标页并等待稳定
4. 执行最少必要交互
5. 记录每一步的观察结果
6. 发现异常后保留 DOM 快照和截图证据
7. 修改代码后重复相同步骤验证是否消失

这样才能把“我觉得修好了”变成“在相同步骤下断言通过”。

## 让 Agent 能验证修复

验证修复至少要同时满足两类证据：

- 结构证据：DOM 快照或断言结果表明预期元素、文本、状态已出现
- 视觉证据：截图表明没有明显错位、遮挡或样式回退

建议在 agent runtime 中把验证结果写成统一事件：

- `browser.navigation.completed`
- `browser.snapshot.captured`
- `browser.screenshot.captured`
- `browser.assertion.passed`
- `browser.assertion.failed`

右栏 chat 可以直接消费这些事件，展示“复现中 / 已截图 / 断言通过”的过程日志。

## 技能目录建议

如果把它做成 Codex skill，建议结构如下：

```text
browser-cdp/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── runtime-integration.md
│   ├── tool-contracts.md
│   └── debugging-playbook.md
└── scripts/
    └── smoke_test.py
```

各文件职责：

- `SKILL.md`
  - 只保留何时触发、首选工作流、何时用快照/截图/交互/断言
- `references/runtime-integration.md`
  - 记录 session 生命周期、等待策略、超时和错误模型
- `references/tool-contracts.md`
  - 记录每个工具的输入输出 schema
- `references/debugging-playbook.md`
  - 记录常见场景，如空白页、hydration mismatch、按钮点击无响应、弹层遮挡
- `scripts/smoke_test.py`
  - 用于验证本地 CDP 连接、导航、截图、快照链路可用

## `SKILL.md` 应该强调的内容

触发描述要足够具体，覆盖这些场景：

- 用户要求复现前端 bug
- 用户要求验证 UI 修复
- 用户要求查看页面 DOM 结构、截图或交互状态
- 用户要求基于真实页面行为判断某个前端问题

正文应保持短小，只写流程规则，例如：

1. 优先用高层 browser tools，不要直接发原始 CDP 命令
2. 先快照，后截图；除非任务明确是视觉问题
3. 每次交互后都重新采样关键状态
4. 修复验证必须包含至少一个断言
5. 返回结论时附上页面证据，而不是只给主观判断

## 一个适合当前仓库的技能描述草案

```md
---
name: browser-cdp
description: Control a Chrome browser through Chrome DevTools Protocol for navigation, DOM snapshots, screenshots, controlled interactions, bug reproduction, and UI fix verification. Use when Codex needs to inspect real page state, reproduce frontend issues, validate UI behavior, or confirm a fix with browser evidence.
---
```

## 建议的最小执行回路

对于“修一个前端 bug”这类请求，agent loop 建议固定为：

1. 用 workspace tools 读取相关代码
2. 用 browser tools 复现问题
3. 保存快照和截图
4. 修改代码
5. 重新构建或热更新页面
6. 再次导航并执行同样的交互
7. 用断言验证修复
8. 返回修复结论和证据

这样浏览器能力才真正和代码编辑闭环，而不是沦为旁路观察器。

## 风险与边界

- 不要把任意 JavaScript 执行权直接暴露给模型，优先使用白名单动作和断言
- 不要把整页 DOM 原文长文本直接喂给模型，必须摘要化
- 不要默认复用脏会话，测试前应支持重置页面状态
- 不要把截图当作唯一真相源，视觉正常不代表交互正常
- 如果页面依赖登录、种子数据或 feature flag，必须把前置条件显式写入工具输入

## 验收口径

当以下链路可稳定完成时，可以认为 CDP 技能接入有效：

1. Codex 能打开目标页面并等待稳定态
2. Codex 能获取结构化 DOM 快照并识别关键控件与错误信息
3. Codex 能生成截图并将其作为验证证据
4. Codex 能执行有限交互来复现问题
5. 代码修改后，Codex 能按相同步骤重新验证并输出通过或失败结论

