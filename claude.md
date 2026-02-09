# 项目概述（claude.md）

## 一句话说明
这是一个基于 **Vite + React + TypeScript** 的前端应用（位于 `app/`），提供「单图生成 / 套图生成（Suite）/ 智能构图（Smart Layout）」等能力，核心图片生成通过 `src/lib/api.ts` 对接火山引擎 Ark/Seedream 的图片生成接口，并配套一套基于 **shadcn/ui + Radix UI + Tailwind CSS** 的组件库与交互体系。

## 目录结构（仓库根）

```
shop/
├─ app/                         # 前端应用（Vite + React + TS）
├─ assets/                      # 资产/参考图
├─ info/                        # 需求、迁移、实现步骤等文档
└─ tech-spec.md                 # 技术规格/设计说明（部分内容与现实现可能存在出入）
```

## 运行与脚本（在 app/ 下）

安装依赖与启动：

```bash
cd app
npm install
npm run dev
```

常用脚本（见 [package.json](file:///c:/codes/shop/app/package.json)）：
- `npm run dev`：本地开发（Vite）
- `npm run build`：类型构建 + 打包（`tsc -b && vite build`）
- `npm run preview`：本地预览打包产物
- `npm run lint`：ESLint

## 核心功能与数据流

### 1) 单图生成
- UI 入口：`src/App.tsx` 在 `domesticMode === 'single'` 时渲染输入与结果区（[App.tsx](file:///c:/codes/shop/app/src/App.tsx)）
- 生成调用：通常经由组件/服务调用 [generateImage](file:///c:/codes/shop/app/src/lib/api.ts#L17-L70)
- 结果呈现：`components/GeneratedGallery.tsx`（目录见 `src/components/`）

### 2) 套图生成（Suite Generation）
- UI：`components/SuiteGenerator/`（模板选择、批量生成、结果展示）
- 核心编排：`src/services/suiteGenerationService.ts`
  - 基于模板 items 生成多个子任务
  - 支持并发（1~4），可将首张生成结果作为后续参考图（[executeSuiteGeneration](file:///c:/codes/shop/app/src/services/suiteGenerationService.ts#L45-L142)）

### 3) 智能构图（Smart Layout）
- UI：`src/components/SmartLayoutView.tsx` + `src/components/smart-layout/*`
  - 画布编辑（区域/层级/参考图）
  - 预览对话框与配置面板
- 核心逻辑：`src/services/smartLayoutService.ts`
  - 生成 layout sketch（语义色块或拼贴图）并输出 base64（[generateLayoutSketch](file:///c:/codes/shop/app/src/services/smartLayoutService.ts#L207-L255)）
  - 组合最终 prompt：GLOBAL_PROMPT + 坐标系统 + 分区提示 + 深度树规则（[composeLayoutForGeneration](file:///c:/codes/shop/app/src/services/smartLayoutService.ts#L342-L478)）
- 辅助工具：`src/lib/smartLayoutUtils.ts`（区域位置提示、颜色分配、bbox 归一化等）

### 4) 全局状态与任务记录
- 状态管理：Zustand + persist（LocalStorage）
- 位置：`src/store/appStore.ts`
  - `activeTab`：`detail | single | smart_layout`
  - `domesticMode`：`single | suite`
  - `tasks`：统一记录生成任务（单图/套图/布局）（[appStore.ts](file:///c:/codes/shop/app/src/store/appStore.ts)）

## API 与环境变量

### 图片生成 API
- 对接文件：`src/lib/api.ts`
- 默认请求地址：`https://ark.cn-beijing.volces.com/api/v3/images/generations`
- 关键环境变量：
  - `VITE_VOLC_API_KEY`：API Key（用于 `Authorization: Bearer ...`）
  - `VITE_USE_MOCK=true`：强制走 mock 生成（不请求真实接口）

说明：
- `generateImage` 会根据 model 与 size 做尺寸归一化（[normalizeImageSize](file:///c:/codes/shop/app/src/lib/utils.ts#L66-L88)）。
- mock 会返回固定的示例图片 URL，用于本地联调（[generateMockImage](file:///c:/codes/shop/app/src/lib/api.ts#L132-L179)）。

## UI/组件体系

### 组件布局（高层）
- 根入口：`src/main.tsx` → `src/App.tsx`
- 页面骨架：Sidebar / Header / MainTabs + 主内容区域（[App.tsx](file:///c:/codes/shop/app/src/App.tsx)）

### shadcn/ui（组件库）
- 目录：`src/components/ui/*`（大量 Radix UI 包装组件）
- 配置：`app/components.json`（别名、样式风格等）（[components.json](file:///c:/codes/shop/app/components.json)）
- 样式：Tailwind + 变量体系（[tailwind.config.js](file:///c:/codes/shop/app/tailwind.config.js) 与 `src/index.css`）

## 构建与工程配置

- Vite 配置：`base: './'`；别名 `@ -> ./src`（[vite.config.ts](file:///c:/codes/shop/app/vite.config.ts)）
- TypeScript：`tsconfig*.json`（app/node 分离）
- ESLint：`eslint.config.js`

## 文档与资料

仓库包含较多需求/实施过程文档，集中在：
- `info/step/*`：按步骤记录的实现说明（API、状态管理、Smart Layout UI/逻辑、Suite 等）
- `info/需求规格说明书.md`、`info/MIGRATION_GUIDE.md` 等
- `tech-spec.md`：技术规格与组件清单（请以实际代码为准）

## 快速定位（常用文件）
- 应用入口与总体渲染：[main.tsx](file:///c:/codes/shop/app/src/main.tsx)、[App.tsx](file:///c:/codes/shop/app/src/App.tsx)
- 全局状态（Zustand）：[appStore.ts](file:///c:/codes/shop/app/src/store/appStore.ts)
- 图片生成 API（Seedream）：[api.ts](file:///c:/codes/shop/app/src/lib/api.ts)
- 智能构图核心逻辑：[smartLayoutService.ts](file:///c:/codes/shop/app/src/services/smartLayoutService.ts)
- 套图生成编排：[suiteGenerationService.ts](file:///c:/codes/shop/app/src/services/suiteGenerationService.ts)

