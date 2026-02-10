# 步骤 3：实现智能布局画布 - 基础交互 (Smart Layout Canvas - Interaction)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **框架**: React 19 + TypeScript
*   **交互库**: 使用 **`react-moveable`** 处理拖拽/缩放，配合 **`selecto`** 处理多选（或者指定 `Konva` / `Fabric.js`，视项目轻重而定）。
*   **样式**: TailwindCSS
*   **组件库**: Shadcn/UI (替代原 Ant Design，以适配整体风格)

## 2. 数据结构定义 (Data Structures)
请严格遵循以下 TypeScript 接口生成代码：

```typescript
// 语义颜色映射表
export const SEMANTIC_COLORS = {
  background: '#E2E8F0', // Slate-200 (Grey)
  prop: '#86EFAC',       // Green-300
  main: '#FCA5A5',       // Red-300
};

export interface LayoutZone {
  id: string;          // UUID
  x: number;           // 左上角 X 坐标
  y: number;           // 左上角 Y 坐标
  width: number;
  height: number;
  zIndex: number;
  type: 'background' | 'prop' | 'main'; // 区域类型
  semanticColor: string; // 自动绑定上述颜色
  sketchColor?: string; // 布局草图用色（用于区分同类型多区域）
  locked?: boolean; // 锁定后不可拖拽/缩放
  prompt?: string;     // 提示词
  refImage?: string;   // 参考图 URL (base64 或 http)
  autoCaption?: string; // AI 反推的描述
  // 由系统计算并展示给用户/写入 Prompt 的结构化定位信息
  bboxNormalized?: { x: number; y: number; w: number; h: number }; // 0~1（仅用于内部调试/兼容；最终 Prompt 使用 px）
  locationHint?: 'Top-Left' | 'Top-Center' | 'Top-Right' | 'Center-Left' | 'Center' | 'Center-Right' | 'Bottom-Left' | 'Bottom-Center' | 'Bottom-Right';
}

export interface SmartLayoutSettings {
  layoutSketchRenderMode: 'collage' | 'segmentation'; // 贴图布局图 | 纯色布局图
  showSketchPreviewWithImages: boolean; // 预览时是否展示贴图（仅影响预览，不影响生成时的真实 renderMode）
  // 结构化提示增强
  enableRegionPrompts: boolean; // 在最终 Prompt 中输出 REGION_PROMPTS 段落（默认开启）
  enableDepthTree: boolean; // 输出 DEPTH_TREE 段落（默认开启）
}

// Canvas 组件 Props
export interface SmartCanvasProps {
  zones: LayoutZone[];
  onChange: (newZones: LayoutZone[]) => void;
  onSelect: (zoneId: string | null) => void; // null 代表取消选中
  canvasSize: { width: number; height: number };
  drawMode?: boolean; // 画框模式：拖拽永远新建 Zone（不受满屏层影响）
}
```

## 3. 任务描述细节 (Detailed Tasks)

**3.1 画布容器 (Canvas Container)**
*   实现一个相对定位的 `div` 作为画板，具有固定的宽高（由 `canvasSize` prop 决定）。
*   **画布尺寸（用户手动定义）**：工具栏提供画布宽高输入（px）并持久化保存。\n    *   画布尺寸影响坐标体系、布局草图尺寸与 Step 4 的 `CanvasSize` / `BBox(px)` 输出。\n    *   当画布缩小导致 Zone 越界时，前端应自动将 Zone 夹紧到画布范围内。
*   **样式调整**：整体工作台应适配暗色主题（Dark Mode）。画布周边区域为深色背景，画板本身保持白色或透明网格以模拟画布，但需确保在深色环境中视觉协调。
*   **工具栏**：在画布上方提供“预览合成图/生成”按钮组，并增加“布局合成图渲染风格”切换。\n    *   渲染风格：\n        *   贴图布局图（Collage，默认）：预览时在布局图里直接贴上 Zone 的素材图。\n        *   纯色布局图（Segmentation）：预览时只显示语义色块，不贴素材图。\n    *   该切换值需要被保存为 `SmartLayoutSettings.layoutSketchRenderMode`，并传递给 Step 4 的合成函数。
*   **保存/复用（必须）**：工具栏提供“保存/复用”入口，至少包含：\n    *   保存为模板（可命名；支持覆盖保存）\n    *   打开模板库（列表展示模板缩略图、名称、更新时间；支持一键应用/删除）\n    *   导出全部模板（JSON）/导入模板（JSON）\n    *   恢复草稿/清除草稿（见 3.7）\n    *   当导入成功但当前画布为空时，应自动应用最新导入的模板；否则打开模板库以便用户手动选择，避免误解“导入无效”。
*   **画框模式（必须）**：工具栏提供“画框模式”开关。\n    *   开启后：鼠标拖拽永远新建 Zone（不受满屏层影响）。\n    *   关闭后：鼠标点击/拖拽优先用于选中与编辑 Zone。\n    *   快捷：按住 `Shift` 可临时强制画框新建（不依赖开关状态）。
*   **高级设置收纳（必须）**：工具栏仅保留高频动作，其余开关收纳至“高级”下拉：\n    *   预览贴图（仅影响预览，不影响生成时真实 renderMode）\n    *   REGION Prompts（输出 REGION_PROMPTS 段落）\n    *   DEPTH Tree（输出 DEPTH_TREE 段落）\n    *   右侧面板显示/隐藏
*   **专注模式（必须）**：提供专注/沉浸切换。\n    *   开启后：隐藏 Header/主 Tabs/FeatureTags/Presets/Footer，仅保留画布与工具栏。\n    *   关闭后：恢复完整工作台结构。
*   **全局参数条联动（对应页面上方红框）**：智能布局页需要读取全局生成上下文（如平台/语言/模型/张数/比例/风格），并做以下 UI 约束：\n    *   `imageCount`（如“6张”）在智能布局模式下默认置灰或提示“智能布局默认单图输出”，避免与 Step 4 强控图生图流程冲突。\n    *   **比例/尺寸不再置灰**：用户可在智能布局模式下切换“智能比例/固定比例”。\n        *   **S1 策略**：`ratioMode=智能比例` 时，输出 `size` 由画布宽高比推导（画布尺寸变化会实时影响生成尺寸预估）。\n        *   `ratioMode=固定比例/分辨率` 时，直接映射到 API `size`（如 16:9 -> 2560x1440；4.0 可选 1K/2K/4K；4.5 可选 2K/4K）。\n    *   **模型校验**：不同模型可用的 `size` 不同，UI 应做可用项禁用/回退（例如 SeedEdit 3.0-i2i 仅支持 adaptive，固定比例选项应不可选）。\n    *   选择平台/语言/风格会影响提示词拼装策略（Step 4 负责落到最终 Prompt），Step 3 负责提供可见的“当前已选平台/语言/风格”的展示与可编辑入口。
*   **结构化布局描述面板（必须）**：在右侧面板提供 Tab“布局描述（给模型看的）”，用于预览最终会写入 Prompt 的结构化段落，并支持复制。\n    *   `GLOBAL_PROMPT`\n    *   `REGION_PROMPTS`（每个 Zone 一条）\n    *   `DEPTH_TREE`\n    *   `规则声明`：例如“不要在最终图片里画任何边框/编号/文字；对象必须严格放在各自区域内”。\n    描述内容由 Step 4 的组装函数实时生成并显示，面板内可折叠展示。
*   **交互逻辑**：
    *   **鼠标按下 (MouseDown)**：若点击在空白处，开始“画框模式”。
    *   **鼠标拖动 (MouseMove)**：实时绘制一个临时的蓝色虚线框，计算 `width/height`。
    *   **鼠标松开 (MouseUp)**：根据虚线框生成新的 `LayoutZone` 数据，添加到列表，默认类型为 `prop`（道具），自动填充对应的 `semanticColor`，并自动设为“选中状态”。

**3.2 区域交互单元 (Zone Item)**
*   遍历 `zones` 数组渲染子组件。
*   使用指定的技术栈（如 `react-moveable`）包裹每个 Zone，提供 8 个方位的 Resize Handle（手柄）。
*   **高亮逻辑**：
    *   选中时：边框为紫色 (`border-violet-500`)，背景微带紫色 (`bg-violet-500/10`)。
    *   未选中时：边框为深灰色 (`border-slate-300`)，背景为浅灰色 (`bg-slate-200/50`)，确保在白色画布上清晰可见。
    *   区域内显示中文类型标签（背景/道具/主体）。
*   **Z-index**：通过 CSS `zIndex` 属性直接绑定数据模型中的 `zIndex`。
*   **坐标提示（必须）**：选中 Zone 时，在 Zone 内或侧边栏显示：\n    *   像素坐标：`x, y, w, h`（单位 px，取整）\n    *   `locationHint`（Center-Left 等）\n    以上信息由系统自动计算，用户不可手动编辑，只用于增强模型理解与调试。
*   **色块提示（必须）**：同类型多区域时，系统应为每个 Zone 计算高区分度 `sketchColor`，用于布局草图与最终 Prompt 的 `color=` 标注，帮助模型区分不同 Region。

**3.3 状态管理与更新 (State Logic)**
*   **不可变更新**：修改 Zone 属性时，必须使用不可变数据写法（Immutable update），例如 `setZones(prev => prev.map(...))`。
*   **删除**：选中状态下按下 `Delete` / `Backspace` 键，或点击右上角悬浮的“X”按钮，触发删除。

**3.4 右侧面板 (Side Panel)**
*   右侧面板为可收起/展开的固定区域，用于承载“区域配置”和“布局描述”两类信息（Tab 切换）。
*   在“区域”Tab 内：仅当 `selectedZoneId` 不为空时显示配置表单；未选中时展示可点击的 Zone 列表。
*   **国际化**：所有界面文本（标题、按钮、标签等）均使用中文。
*   包含字段：
    *   提示词描述 (TextArea): 支持多行输入。
    *   区域类型 (Select): 下拉选择背景层/道具层/主体层。
    *   参考图片 (Upload): 支持上传新图片与从“素材库”选择已上传图片；上传后预览缩略图，支持移除。
    *   图层顺序 (Z-Index): 提供“前移一层”和“后移一层”按钮。
    *   锁定图层 (Locked): 锁定后不可拖拽/缩放（用于满屏背景层等场景防误触）。
*   **交互补充**：\n    *   上传参考图片后，触发一次“自动反推描述”（可先 Mock），写入 `autoCaption`。\n    *   Prompt 输入框建议提供一个小按钮“插入自动描述”，将 `autoCaption` 合并到 `prompt`（避免直接覆盖用户手写内容）。
*   **遮挡/深度关系（必须）**：在侧边栏增加“遮挡关系”编辑区：\n    *   默认规则：zIndex 越大越靠前。\n    *   支持用户为当前 Zone 选择“覆盖对象”（multi-select：选择被覆盖的 Zone），用于生成 `DEPTH_TREE`。\n    *   提供一个快捷按钮“按 zIndex 自动生成遮挡树”。

**3.6 风格变体生成（同图多风格）**
*   在预览弹窗提供“风格变体”输入区，允许一次性生成多种风格结果（例如 3 种）。
*   变体不应要求用户重复上传同一素材图；同一素材可跨多个 Zone/多个变体复用。

**3.5 下方能力卡片联动（对应页面下方红框）**\n*   智能布局页底部展示“能力卡片（Preset）”，卡片内容应根据顶部参数条的 `scene/platform/language/stylePreset` 自动变化。\n*   点击某张卡片时，应自动回填顶部参数条（例如：选择“品牌模型”卡片自动打开 `stylePreset` 并切换到推荐语言），同时保持当前智能布局画布不被清空。\n*   卡片与顶部参数条需要双向联动：\n    *   顶部参数变化 -> 重新计算推荐卡片与默认选中\n    *   点击卡片 -> 批量设置顶部参数（互斥项自动修正）

**3.7 本地持久化：草稿与模板库（必须）**
*   **草稿自动保存**：用户在画布上发生有效变更（zones/canvasSize/settings/context）时，以 debounce（例如 500~1000ms）自动保存草稿。\n    *   保存内容：`canvasSize + zones + settings + generationContextSnapshot`。\n    *   进入智能布局页时检测草稿：若当前画布为空则弹窗提示“恢复/放弃”；并提供工具栏入口手动恢复/清除。\n    *   清空画布时应同时清除草稿，避免下次误恢复。
*   **模板库**：保存/覆盖保存、应用、删除。\n    *   模板应包含 `payload`（同草稿）与可选 `snapshotDataUrl`（用于模板库缩略图展示）。\n    *   缩略图建议使用 Segmentation 渲染，避免贴图导致体积膨胀。
*   **导入/导出**：\n    *   导出单个模板/导出全部模板为 JSON。\n    *   导入 JSON 时需兼容两种格式：`{ templates: [...] }` 或直接数组。\n    *   导入后需刷新模板列表并提供可见反馈（自动应用或打开模板库）。
*   **容量与降级策略**：浏览器本地存储容量有限（尤其是 Base64 图片）。若写入失败（如 QuotaExceeded），应明确提示，并允许降级（例如移除模板预览图以确保落盘）。\n    *   素材图应优先走“素材库资源 id 引用”，避免在模板/草稿内重复存储图片 Base64。

## 4. 边界条件 (Edge Cases)
*   **防误触**：拖拽距离小于 5px 不应视为“画框”，应视为“点击取消选中”。
*   **最小限制**：Zone 的宽或高不能小于 20px，若画框过小自动忽略。
*   **边界限制**：拖拽 Zone 时，禁止将其移出画布可视区域（Keep inside bounds）。

## 交付物
*   可交互的画布组件，用户可以自由布局色块/图片。
*   数据层能实时获取当前的 `LayoutZone[]` 列表数据。
