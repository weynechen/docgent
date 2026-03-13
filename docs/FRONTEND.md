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

## 关键入口

- 工作台：`frontend/src/app/App.tsx`
- 状态：`frontend/src/app/store.ts`
- 编辑器模板：`@/components/tiptap-templates/simple/`
