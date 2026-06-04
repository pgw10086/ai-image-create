# AI Image Create

AI Image Create 是一个基于 Vite、React、TypeScript 的前端图片生成工具，面向电商商品图、套图和构图草稿等场景。项目支持单图生成、套图批量生成和 Smart Layout 智能构图，通过火山引擎 Ark/Seedream 与 Gemini 图片能力生成图片，并使用 shadcn/ui、Radix UI、Tailwind CSS 构建界面。

## 核心能力

- 单图生成：输入商品图或描述后生成商品场景图、详情图、营销图等图片。
- 套图生成：基于模板批量生成多张关联图片，适合电商详情页、品牌展示和素材扩展。
- Smart Layout 智能构图：用画布区域、层级、参考图和提示词约束最终画面布局。
- 任务记录：通过 Zustand 持久化生成任务、结果和失败状态，方便回看与继续调整。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Zustand
- Framer Motion

## 目录结构

```text
.
├── app/                # 前端应用
├── assets/             # 参考图和静态资源
├── info/               # 需求、迁移、实现说明等文档
├── tech-spec.md        # 技术规格说明
└── README.md           # 项目说明
```

## 快速开始

进入前端目录并安装依赖：

```bash
cd app
npm install
```

启动本地开发服务：

```bash
npm run dev
```

构建生产包：

```bash
npm run build
```

运行代码检查：

```bash
npm run lint
```

## 环境变量

在 `app/` 目录下创建 `.env.local`：

```env
VITE_VOLC_API_KEY=your_volc_api_key
VITE_GOOGLE_API_KEY=your_google_api_key
VITE_USE_MOCK=false
```

说明：

- `VITE_VOLC_API_KEY`：火山引擎 Ark/Seedream 图片生成接口密钥。
- `VITE_GOOGLE_API_KEY`：Gemini 图片或视觉理解相关能力使用的密钥。
- `VITE_USE_MOCK=true`：启用 mock 图片生成，不请求真实接口。

## 主要功能入口

- 应用入口：`app/src/main.tsx`
- 页面骨架：`app/src/App.tsx`
- 图片生成 API：`app/src/lib/api.ts`
- 全局状态：`app/src/store/appStore.ts`
- 套图生成：`app/src/services/suiteGenerationService.ts`
- Smart Layout：`app/src/components/SmartLayoutView.tsx`
- Smart Layout 生成逻辑：`app/src/services/smartLayoutService.ts`

