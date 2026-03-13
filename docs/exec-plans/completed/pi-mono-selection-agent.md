# pi-mono 选区改写 Agent 接入（历史原型）

## 目标

将当前前端内的 mock 改写逻辑替换为本地 Node agent 服务，保持 MVP 的选区改写交互不变，同时引入真实模型能力与更清晰的运行状态反馈。

说明：该方案已降级为历史过渡原型，长期方向改为云端 Python API service + Python agent runtime。

## 已完成决策

1. 采用本地 Node 服务承载 agent runtime，而不是浏览器直连模型。
2. 使用 `@mariozechner/pi-ai` 构建极简 rewrite agent，不引入复杂多 agent 编排。
3. 模型接口统一走 OpenAI 兼容协议，通过环境变量配置。
4. 首版只发送选区、标题和少量前后文，不发送整篇文档。
5. agent 只返回建议与解释，不允许直接写回正文。
6. 前端采用“流式状态 + 最终结果”，而不是逐 token 展示正文。

## 实现摘要

- 新增 `/api/ai/rewrite` 与 SSE 事件流接口
- 右栏接入 agent 运行状态展示
- 建议卡片展示模型来源、解释和 diff 预览
- 应用建议后继续沿用现有版本快照逻辑

## 后续缺口

1. 增加 agent 服务的自动化测试
2. 为 prompt 和输出质量建立回归样例
3. 评估是否加入预设动作按钮与更细的失败恢复策略
