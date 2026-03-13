# Writing IDE MVP

这是一个基于 React + Tiptap 的 Docs-as-Code AI 写作 IDE 原型。

## 文档入口

- 产品规格：`product-specs/index.md`
- 设计文档：`design-docs/index.md`
- 架构地图：`../ARCHITECTURE.md`
- 计划与技术债：`PLANS.md`

## 当前状态

项目已完成第一轮工作台 UI 与编辑体验建设，并进入真实 AI 功能接入阶段。

当前 AI 方案：

- 右栏仍保持选区改写工作流，不扩展为通用聊天区
- 前端通过 `/api/ai/rewrite` 调用本地 Node agent 服务
- 本地服务使用 `@mariozechner/pi-ai` 驱动极简 rewrite agent
- agent 只接收选区、标题和少量前后文，并返回“建议 + 解释”，不直接写回正文

## 本地启动

1. 复制环境变量模板：`cp .env.example .env`
2. 配置 `OPENAI_API_KEY`
3. 运行：`npm install && npm run dev`

说明：`npm run dev` 会自动为本地 agent 进程加载根目录下的 `.env`。
