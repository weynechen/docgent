# 技术债跟踪

## 高优先级

1. `frontend/src/app/store.ts`
   - AI 建议应用与富文本选区同步仍然依赖较脆弱的范围映射
2. `@/components/tiptap-templates/simple/`
   - 官方模板整体体积较大，引入了超出 MVP 需求的能力
3. `frontend/src/shared/markdown.ts`
   - Markdown 往返转换仍是简化实现，复杂结构下存在失真风险

## 中优先级

1. 当前 mock 文档存储尚未落到真实文件系统
2. 版本系统尚未与 Git 对齐
3. 构建产物体积较大，仍有 chunk size warning

## 低优先级

1. 右侧 AI 面板还可以进一步做信息压缩
2. 文档结构与实现状态之间仍缺少自动化校验
