# 步骤 9：上传模板图片解析为智能布局模板（P0）

## 目标
- 在智能布局页面支持上传一张“商品模板图/成品图”，通过视觉大模型解析其版式并生成 `LayoutZone[]`。
- 解析结果直接进入现有智能布局编辑态，用户可微调并“保存为模板”沉淀复用。
- 文本尽量保留原文（标题/卖点/标签等写入对应 zone 的 prompt，可编辑修正）。

## 关键交互
- 入口：工具栏「保存/复用」→「从图片解析模板」
- 上传图片后进入解析中状态；成功后自动应用解析结果，并弹出“保存为模板”对话框（预填模板名）
- 失败场景需给出可理解的错误提示（未配置 Gemini Key / 超时 / JSON 不合法 / 解析失败）

## 数据结构约束
- 复用现有 schemaVersion=1：`SmartLayoutDraftV1 / SmartLayoutTemplateV1`
- `canvasSize`：使用原图宽高
- `zones`：至少 background + main（若可识别），其余为 prop；坐标以 `bboxNormalized (0~1)` 为主，前端换算为 px 并做 clamp

## 代码落点（建议）
- 模型调用：在 `app/src/lib/api.ts` 新增“解析模板图片”方法，复用 `GoogleGenAI` 客户端与 `toInlineData()`，以 `responseModalities: ['TEXT']` 输出 JSON
- UI 接入：在 `SmartLayoutView` 增加图片上传 input 与菜单项；解析成功后更新 `canvasSize/zones/settings`，并引导保存模板
- 颜色与富化：沿用 `SEMANTIC_COLORS` 与 `enrichZonesForPrompt()`，保证 `bboxNormalized/locationHint/sketchColor` 一致

