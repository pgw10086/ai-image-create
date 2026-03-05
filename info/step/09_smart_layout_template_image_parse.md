# 步骤 9：上传模板图片解析为智能布局模板（P0）

## 目标
- 在智能布局页面支持上传一张“商品模板图/成品图”，通过视觉大模型解析其版式并生成 `LayoutZone[]`。
- 解析结果直接进入现有智能布局编辑态，用户可微调并“保存为模板”沉淀复用。
- 文本尽量保留原文（标题/卖点/标签等写入对应 zone 的 prompt，可编辑修正）。
- 主商品不写死：prompt 使用 `{PRODUCT}` 占位符；通过“商品主体”输入一键替换生成内容。

## 关键交互
- 入口：工具栏「保存/复用」→「从图片解析模板」
- 顶部工具栏提供“商品主体”输入，用于替换 `{PRODUCT}`
- 解析前弹出“解析模板设置”：选择输出提示词语言（自动/中文/英文）与商品主体提示（可选）
- 上传图片后进入解析中状态；成功后自动应用解析结果，并弹出“保存为模板”对话框（预填模板名）
- 失败场景需给出可理解的错误提示（未配置 Gemini Key / 超时 / JSON 不合法 / 解析失败）
- 主体不确定时：解析结果会返回主体置信度与候选区域；前端弹出“确认主体区域”对话框，用户点选候选后将对应 zone 设为 `main`

## 数据结构约束
- 复用现有 schemaVersion=1：`SmartLayoutDraftV1 / SmartLayoutTemplateV1`
- `canvasSize`：使用原图宽高
- `zones`：至少 background + main（若可识别），其余为 prop；坐标以 `bboxNormalized (0~1)` 为主，前端换算为 px 并做 clamp

## 代码落点（当前）
- 模型调用：`app/src/lib/api.ts` 的 `parseSmartLayoutTemplateFromImage(...)`（Gemini 多模态输出 JSON，并带错误归一化）
- UI 接入：`app/src/components/SmartLayoutView.tsx`（入口菜单 + 上传 + 解析进度 + 应用结果 + 主体候选确认 + 引导保存模板）
- 颜色与富化：沿用 `SEMANTIC_COLORS` 与 zones 富化逻辑，保证 `bboxNormalized/locationHint/sketchColor` 一致
