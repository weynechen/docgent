# RELIABILITY

## 当前可靠性边界

- 保存操作依赖 mock 文档存储
- 版本恢复依赖 localStorage 快照
- AI 改写已迁移到模板化 Python backend，并依赖外部模型接口
- 当前 rewrite run 仍是进程内内存态，不具备跨进程恢复能力
- 即将引入的 agentic chat 需要在流式消息、工具调用和写回动作上重新定义可靠性边界

## 主要风险

1. 富文本选区与版本恢复之间仍可能存在同步问题
2. Markdown 往返在复杂内容下可能失真
3. localStorage 不适合作为长期版本存储
4. rewrite run 当前未持久化，进程重启会丢失流式状态
5. agent loop 若中途失败，可能造成消息流、工具状态与最终写入状态不一致
6. 自动写回若没有 revision 校验，可能覆盖用户刚刚完成的本地编辑

## 短期措施

- 维持轻量版本快照
- 减少过度复杂的编辑器能力
- 把关键风险记录到技术债和执行计划
- 后续优先把 rewrite run 接到模板后端已有的更长期任务能力或持久化层
- 为 agent streaming 增加明确的事件类型、结束态和取消语义
- 为 `Write` 工具增加 revision guard 与冲突反馈

## 日志约束

- 后端默认将关键运行日志写入仓库根目录 `logs/`
- 每次后端重启都会创建新的 `logs/runs/<timestamp-pid>/` 目录，`logs/latest` 始终指向最近一次启动
- `logs/` 不纳入 Git，避免把高频运行产物提交到仓库
- 至少保留访问日志、应用错误日志和未处理异常日志，便于直接从工作区定位问题
- 日志默认带 `request_id`、`trace_id`、`span_id`，用于串联单次请求、后台任务与未来的链路追踪
- 不默认记录请求体、鉴权 token、Cookie 等敏感信息
- 日志采用结构化 JSON 行格式，便于后续接入 OpenTelemetry、ELK、Loki 或云厂商日志平台
- 本地排障默认只看 `logs/latest/`，避免把历史会话日志和当前问题混在一起
