# 自由生成模板套用后双区域布局设计

日期：2026-03-05
范围：`domesticMode === 'single'` 的自由生图页面

## 1. 目标与约束

本次改造目标是优化“套用模板”后的编辑体验：

1. 仅当用户点击“套用模板”时，页面切换为左右分区布局。
2. 左侧保留生成主流程（输入、参数、生成结果），右侧展示模板效果图（取自模板卡片的 `template.image`）。
3. 输入区默认折叠；且每次重新点击“套用模板”都重置为折叠状态。
4. 移动端不做抽屉，改为上下堆叠：右侧效果图落在左侧主区下方。
5. 不改变当前“模板变量赋值、比例联动、生成逻辑”的既有行为。

## 2. 架构与状态设计

采用全局状态（Zustand）统一管理展示态，避免跨组件回调链。

在 `src/store/appStore.ts` 新增：

- `singleTemplateUi: {
  isApplied: boolean;
  previewImage: string | null;
  previewTitle: string;
  isInputCollapsed: boolean;
  appliedAt: number | null;
}`
- `applySingleTemplatePreview(payload: { image: string; title: string }): void`
- `toggleSingleInputCollapsed(): void`
- `clearSingleTemplatePreview(): void`（预留关闭能力，首版可不暴露按钮）

状态规则：

- 调用 `applySingleTemplatePreview` 时：
  - `isApplied = true`
  - `previewImage = payload.image`
  - `previewTitle = payload.title`
  - `isInputCollapsed = true`（强制重置）
  - `appliedAt = Date.now()`
- `toggleSingleInputCollapsed` 仅翻转当前折叠态，不影响其他字段。

这样可以精确满足“只在点击套用后生效”，并且不会被 `inputTemplatePreset` 持久化恢复误触发。

## 3. 组件改造与UI行为

### 3.1 `CaseGallery`

在模板“套用”入口追加调用：

- `applySingleTemplatePreview({ image: template.image, title: template.title })`

保留现有行为不变：

- `setInputTemplatePreset(...)`
- 宣传海报图仍自动设置 `ratioMode: '16:9'`

### 3.2 `App`

当前单页渲染顺序为：`InputArea -> FeatureTags -> GeneratedGallery -> CaseGallery`。
改造后：

- 当 `domesticMode === 'single' && singleTemplateUi.isApplied`：
  - 使用双区域容器（桌面两列，移动端一列堆叠）
  - 左区：`InputArea`、`FeatureTags`、`GeneratedGallery`
  - 右区：模板效果图卡片（固定标题“模板效果图” + 模板名 + 图片）
- 未套用模板时保持原单列布局。

### 3.3 `InputArea`

新增折叠控制条（例如标题栏 + chevron 按钮）：

- 默认依据 `singleTemplateUi.isInputCollapsed`
- 折叠时仅显示头部与展开按钮
- 展开后显示现有输入编辑完整区域
- 不改动 `handleGenerate`、模板识图、上传图片逻辑

## 4. 数据流与边界行为

主数据流：

1. 用户在模板库点击“套用模板”
2. `CaseGallery` 更新模板内容/比例 + 写入 `singleTemplateUi`
3. `App` 读取 `singleTemplateUi.isApplied`，切到双区域布局
4. `InputArea` 读取 `isInputCollapsed=true`，默认折叠
5. 用户手动展开后仅切换 `isInputCollapsed`，再次套用模板会重置折叠

边界与降级：

- 若 `previewImage` 为空或加载失败：右侧显示占位态（灰底、文案“模板预览不可用”），左侧流程不受影响。
- 若用户切换到套图模式：双区域不生效（仍按套图页面逻辑）。
- 若刷新页面：`singleTemplateUi` 是否持久化按现有 persist 策略执行；即使持久化，触发源依然仅来自“套用模板”写入。

## 5. 验证方案

功能验证：

1. 未点击套用模板，页面保持原单列。
2. 点击“商品详情图”模板套用后，页面变双区域，右侧显示对应模板图，输入区折叠。
3. 展开输入区后再次点击任意模板套用，输入区重置折叠。
4. 点击“宣传海报图”模板套用后，比例自动为 `16:9` 且双区域正确显示。
5. 移动端宽度下右侧区域自动下移到左区下方。
6. 生成流程、识图流程、历史任务展示不回归。

技术验证：

- `npm run build`
- 可选：`npm run lint`（当前仓库存在历史 lint 问题，作为回归参考，不作为本次阻断）

## 6. 实施顺序（执行建议）

1. 先改 store（字段 + actions + 初始值）
2. 改 `CaseGallery` 写入展示态
3. 改 `App` 布局切换与右侧预览卡片
4. 改 `InputArea` 折叠头与折叠渲染
5. 自测与构建验证
