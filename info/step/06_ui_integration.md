# 步骤 6：UI 整合与细节优化 (UI Integration & Polish)

## 1. 技术栈规范 (Tech Stack Specifications)
*   **路由**: 使用简单的状态条件渲染（Conditional Rendering），暂不引入 React Router，保持单页应用架构。
*   **动画**: 使用 `framer-motion` 实现平滑的页面切换和列表加载动画。

## 2. 任务描述细节 (Detailed Tasks)

**3.1 导航整合**
*   修改 `src/components/MainTabs.tsx`，将 Tab 扩展为：
    *   **自由生成** (原有功能)
    *   **智能画布** (Step 3 & 4)
    *   **套图模版** (Step 5)
*   确保切换 Tab 时，`InputArea` 和 `ResultGallery` 的状态能正确切换或重置。

**3.2 样式统一**
*   **主题色**：统一使用紫色系（Violet-600）作为主色调，深灰（Zinc-900）作为背景色。
*   **组件复用**：将 Button, Input, Card 等基础组件统一复用 `src/components/ui/` 下的 Shadcn UI 组件。

**3.3 结果画廊升级**
*   修改 `src/components/GeneratedGallery.tsx`。
*   **筛选功能**：添加 Tab 栏，允许用户筛选“全部”、“套图”、“单图”。
*   **查看大图**：点击图片弹出 Lightbox，支持左右切换和键盘操作。

**3.4 Mock 数据清理与兜底**
*   **全局检查**：搜索代码中的 `https://images.unsplash.com`，将其替换为本地的 Mock 图片或占位符逻辑。
*   **API Key 检查**：在应用启动时（`App.tsx` useEffect），检查环境变量 `VITE_VOLC_API_KEY`。若未配置，自动弹出一个不可关闭的 Toast 或 Banner，提示“当前为演示模式，生成功能将使用模拟数据”。

**3.5 顶部参数条联动（红框区域）**
*   顶部参数条作为“全局生成上下文”，必须联动到实际生成请求与提示词，而不是仅做选中态。
*   单图与套图均需消费该上下文：
    *   **张数（6张/8张）**：使用 Seedream 4.0/4.5 的组图能力，映射为 `sequential_image_generation='auto'` + `sequential_image_generation_options.max_images`，并遵循“参考图数量 + 生成数量 ≤ 15”的约束（超出自动截断）。
    *   **智能比例**：既要在 API 参数里体现 `size`，也要在 prompt 里写明尺寸/比例提示（避免模型忽略），两者同时生效。
    *   **参考风格**：以“文本风格预设”方式追加到 prompt（不占用参考图配额）。
    *   **平台/语言/场景**：以 prompt 规则形式追加（不做强合规审查与自动翻译）。

**3.6 上传入口统一**
*   红框“上传文件”与输入框/套图页的上传行为保持一致：点击即可打开文件选择器，并写入同一份 `uploadedImages`。

**3.7 智能布局页面布局优化**
*   内容区在大屏需居中显示（避免整体贴左、右侧出现大块空白）。
*   智能布局支持“专注模式”：隐藏 Header/主 Tabs/FeatureTags/Presets/Footer，仅保留画布与工具栏。
*   智能布局右侧面板使用 Tab 承载“区域配置/布局描述”，并支持收起/展开以最大化画布。

## 4. 边界条件 (Edge Cases)
*   **响应式适配**：确保 Canvas 在移动端（屏幕宽度 < 768px）下自动缩放或提示“请使用桌面端访问”。
*   **性能优化**：对 ResultGallery 中的大图启用 `loading="lazy"`。

## 交付物
*   最终集成完成的前端工作台。
*   能够流畅演示所有新功能的版本。
