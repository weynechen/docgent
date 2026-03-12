# DB Schema

当前项目没有正式数据库。

## 当前持久化方式

- 文档：内存 mock store
- 版本快照：浏览器 `localStorage`

## 后续演进建议

若进入本地应用阶段，可考虑：

1. SQLite 存版本元数据与索引
2. 文件系统存正文 Markdown
3. Git 或兼容实现存历史 diff
