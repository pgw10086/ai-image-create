# 步骤 7：清理冗余功能 (Cleanup)

## 1. 任务描述细节 (Detailed Tasks)

**3.1 移除顶部栏多余元素**
*   修改 `src/components/Header.tsx`。
*   删除“Notification Bell”图标及其点击事件。
*   删除“Feedback”按钮。
*   删除“User Avatar”区域。
*   **保留**：Logo（如果有）、算力（Credits）展示组件。

**3.2 清理侧边栏**
*   修改 `src/components/Sidebar.tsx`。
*   删除“Settings”入口。
*   检查 `navItems` 数组，仅保留与新功能（自由生成、智能画布、套图模版）相关的导航项。

**3.3 移除悬浮按钮**
*   修改 `src/App.tsx`。
*   彻底删除右下角的“新用户添加客服领算力”悬浮按钮及其相关动画代码。

**3.4 清理功能入口**
*   **ToolCards**：修改 `src/components/ToolCards.tsx`，移除所有“开发中”的占位卡片（如局部重绘、商品替换等），除非它们已被重构为新功能的入口。
*   **CapabilityCards**：保留作为“快捷预设入口”（点击一键应用套图预设）；移除与当前版本无关的占位卡片。

## 2. 代码库检查
*   运行 `npm run lint` 或 `tsc`，确保移除代码后没有残留未使用的变量或导入（Unused imports/variables）。
*   删除 `src/assets` 下未使用的图片资源。

## 交付物
*   精简后的代码库，无死链、无冗余 UI。
