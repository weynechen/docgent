# FRONTEND

## 当前前端技术栈

- React
- Vite
- Tiptap
- Zustand
- Tailwind CSS v4

## 当前前端原则

1. 编辑器体验优先于装饰性 UI。
2. 产品工作台布局由 `frontend/src/app/App.tsx` 统一编排。
3. 官方 Tiptap 模板可以复用，但必须本地化并可裁剪。
4. 排版调优应直接面向写作场景，不盲从模板默认值。
5. 右侧 AI Chat 必须支持多轮消息、流式更新和自动滚动，不接受“整条消息结束后再渲染”的交互。
6. AI 状态模型应从单次 rewrite candidate 升级为会话、消息、步骤和写入结果并存的结构。

## 关键入口

- 工作台：`frontend/src/app/App.tsx`
- 状态：`frontend/src/app/store.ts`
- 编辑器模板：`@/components/tiptap-templates/simple/`
- AI provider：`frontend/src/ai/provider.ts`
