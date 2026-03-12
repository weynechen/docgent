# 设计文档索引

## 目的

本目录记录产品设计原则、验证状态和关键设计决策。这里描述“为什么这样设计”，而不是逐项实现细节。

## 文档列表

- `core-beliefs.md`
  - 核心理念与智能体优先的工作原则
- `ui-workspace-current.md`
  - 当前工作台 UI 结构、关键交互和已验证决策
- `validation-status.md`
  - 当前 MVP 已验证、部分验证、未验证的设计假设

## 历史输入来源

- `docs/designs/docs_as_code_ai_writing_ide_prd.md`
  - 早期 PRD 原稿，保留作历史输入，不再作为唯一事实来源
- `docs/designs/ui/`
  - UI 参考素材与导出的模板输入

## 当前状态

- 验证状态：`部分验证`
- 最近一次对齐：已对齐三栏工作台、标签栏、左右栏折叠/调宽、轻量 AI 面板、官方 Tiptap 编辑器模板
- 仍待验证：真实文件系统、真实 LLM provider、长文性能、版本恢复与复杂富文本同步
