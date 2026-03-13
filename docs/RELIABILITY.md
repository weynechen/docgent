# RELIABILITY

## 当前可靠性边界

- 保存操作依赖 mock 文档存储
- 版本恢复依赖 localStorage 快照
- AI 改写当前仍依赖本地 Node 原型与外部模型接口
- 长期目标是模板式 Python backend + LangChain agent 能力

## 主要风险

1. 富文本选区与版本恢复之间仍可能存在同步问题
2. Markdown 往返在复杂内容下可能失真
3. localStorage 不适合作为长期版本存储
4. 本地原型与模板式 Python backend 并存时，容易出现双主线认知混乱

## 短期措施

- 维持轻量版本快照
- 减少过度复杂的编辑器能力
- 把关键风险记录到技术债和执行计划
- 将当前本地 Node 原型降级为过渡实现，尽快迁移到 `backend` 的 Python/LangChain 实现
