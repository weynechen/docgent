# Agent Map

本仓库的长期知识库位于 `docs/`，`AGENTS.md` 只做导航，不承载完整事实。

## 先读哪里

- 产品目标与范围：`docs/product-specs/index.md`
- 设计原则与已验证方向：`docs/design-docs/index.md`
- 核心理念：`docs/design-docs/core-beliefs.md`
- 架构分层与模块地图：`ARCHITECTURE.md`
- 当前计划与技术债：`docs/PLANS.md`
- 前端约束：`docs/FRONTEND.md`
- 可靠性与安全边界：`docs/RELIABILITY.md`、`docs/SECURITY.md`

## 记录系统原则

重要：不要让文档腐烂，当设计变更，进度变更时，必须更新对应的文档。
1. `docs/` 是代码仓库的记录系统，重要决策必须写回仓库，而不是停留在对话里。
2. 计划是第一等工件：复杂工作进入 `docs/exec-plans/active/`，完成后移到 `docs/exec-plans/completed/`。
3. 产品与设计信息分层维护：产品规格写在 `docs/product-specs/`，设计理念和验证状态写在 `docs/design-docs/`。
4. 质量不是口头判断，要在 `docs/QUALITY_SCORE.md` 中持续评分并记录差距。
5. 若发现文档与代码不一致，优先修正文档索引与相关源文档，再继续实现。

## 默认工作方式

- 修改功能前，先确认是否已有相关计划、规格或技术债记录。
- 完成较大改动后，更新对应文档、索引和质量评分。
- 生成式内容、外部模板和参考资料放在 `docs/references/`，不要把它们误当成产品真相来源。

## 测试方式
- 使用chrome mcp可以直接访问，用户会手动启动chrome浏览器
```bash
  google-chrome-stable \
    --remote-debugging-port=9222 \
    --user-data-dir=/tmp/chrome-codex-mcp \
    --no-first-run \
    --no-default-browser-check \
    --ozone-platform=wayland
```

- 使用http://localhost:5173/ 地址进行访问

