# RELIABILITY

## 当前可靠性边界

- 保存操作依赖 mock 文档存储
- 版本恢复依赖 localStorage 快照
- AI 改写依赖 mock provider

## 主要风险

1. 富文本选区与版本恢复之间仍可能存在同步问题
2. Markdown 往返在复杂内容下可能失真
3. localStorage 不适合作为长期版本存储

## 短期措施

- 维持轻量版本快照
- 减少过度复杂的编辑器能力
- 把关键风险记录到技术债和执行计划
