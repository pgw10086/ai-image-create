# 步骤 03 总结：智能布局画布（UI + 基础预览能力）

## 1. 概述
步骤 03 实现了“智能布局画布”模块的 UI 与基础交互：用户可以在画布上创建多个 Zone，拖拽/缩放调整位置与尺寸，并为每个 Zone 配置类型、提示词与参考图片；同时支持用户手动设置画布尺寸、画框模式（强制拖拽新建）与图层锁定，提升复杂布局下的可用性。该阶段为步骤 04 的合成与生成逻辑提供稳定的输入数据与交互基础。

## 2. 核心能力与改动点

### 2.1 智能画布（SmartCanvas）
- 支持在空白处拖拽画框创建 Zone（默认类型为“道具”，并自动绑定语义色 `semanticColor`）。
- 通过 `react-moveable` 支持 Zone 的拖拽与 8 点缩放，带画布边界约束。
- 适配暗色主题：外层为深色，画布保持白色/网格模拟纸张效果。
- 支持“画框模式”与 `Shift` 强制画框新建，避免满屏图层导致无法新建区域。

### 2.2 Zone 展示（ZoneItem）
- 选中态：紫色边框（Violet）+ 微紫背景，突出当前操作对象。
- 未选中态：深灰边框，背景按 `semanticColor` 半透明填充，保证在白色画布上边界清晰可辨。
- 显示中文类型标签（背景/道具/主体），并在无图片时显示提示词预览。
- 显示像素坐标信息（x,y,w,h），用于调试与生成校验。
- 同类型多区域时使用高区分度 `sketchColor`，提升布局草图区分度与提示词可读性。

### 2.3 配置面板（ConfigPanel）
- 全中文界面（标题、按钮、字段、提示文本均已本地化）。
- 类型切换时同步更新 `semanticColor`（背景/道具/主体对应不同语义色）。
- 上传参考图片后触发一次“自动反推描述”（Mock），写入 `autoCaption`。
- 提供“插入自动描述”按钮，将 `autoCaption` 合并到 `prompt`（避免覆盖用户输入）。
- 提供“锁定图层”开关：锁定后不可拖拽/缩放，降低满屏背景层误操作概率。

### 2.4 工具栏与预览设置（SmartLayoutSettings）
- 工具栏提供“预览合成图 / 立即生成”按钮组。
- 支持“布局合成图渲染风格”切换：
  - `collage`（贴图布局图）：Zone 有参考图时可贴图。
  - `segmentation`（纯色布局图）：仅显示语义色块。
- 支持“预览贴图”开关：仅影响预览展示，不影响最终生成使用的真实 `layoutSketchRenderMode`。
- 工具栏支持画布宽高（px）手动输入并持久化保存。
- 设置项会被持久化保存（用于步骤 04 读取并复用）。

## 3. 提供给步骤 04 的输入/接口

### 3.1 核心数据结构
步骤 04 直接消费 `LayoutZone[]` 与 `SmartLayoutSettings`：

```ts
export const SEMANTIC_COLORS = {
  background: '#E2E8F0',
  prop: '#86EFAC',
  main: '#FCA5A5',
};

export interface LayoutZone {
  id: string;
  x: number; y: number; width: number; height: number;
  zIndex: number;
  type: 'background' | 'prop' | 'main';
  semanticColor: string;
  sketchColor?: string;
  locked?: boolean;
  prompt?: string;
  refImage?: string;
  autoCaption?: string;
}

export interface SmartLayoutSettings {
  layoutSketchRenderMode: 'collage' | 'segmentation';
  showSketchPreviewWithImages: boolean;
  enableRegionPrompts: boolean;
  enableDepthTree: boolean;
}
```

### 3.2 合成/组装能力（已具备）
步骤 04 可以直接复用以下能力：
- `generateLayoutSketch(request, renderMode, targetSizeStr?)`：生成布局草图（贴图或纯色）。
- `composeLayoutPrompt(zones, context?)`：输出包含 GLOBAL / REGION / DEPTH / RULES 的结构化 Prompt（区域坐标使用 px）。

## 4. 备注
- `selecto` 多选依赖已安装，但步骤 03 仍以单选/单区操作为主，是否启用多选由后续需求决定。
