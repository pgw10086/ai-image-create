# Flyelep 飞象Agent平台 - 技术规格文档

## 组件清单

### shadcn/ui 组件
- `button` - 按钮组件
- `card` - 卡片组件
- `input` - 输入框组件
- `badge` - 标签组件
- `tooltip` - 提示组件
- `scroll-area` - 滚动区域
- `avatar` - 头像组件
- `separator` - 分隔线
- `dropdown-menu` - 下拉菜单

### 自定义组件

| 组件名 | 用途 | 位置 |
|--------|------|------|
| Sidebar | 左侧导航栏 | `components/Sidebar.tsx` |
| Header | 顶部导航栏 | `components/Header.tsx` |
| MainTabs | 主选项卡切换 | `components/MainTabs.tsx` |
| InputArea | 输入框区域 | `components/InputArea.tsx` |
| FeatureTags | 功能标签栏 | `components/FeatureTags.tsx` |
| CapabilityCards | 平台能力卡片 | `components/CapabilityCards.tsx` |
| CaseGallery | 案例展示区域 | `components/CaseGallery.tsx` |

## 动画实现方案

| 动画效果 | 实现库 | 实现方式 | 复杂度 |
|----------|--------|----------|--------|
| 页面入场动画 | Framer Motion | AnimatePresence + motion.div | 中 |
| 卡片悬停效果 | Framer Motion | whileHover + variants | 低 |
| 选项卡切换 | Framer Motion | layoutId + animate | 中 |
| 标签悬停 | CSS/Tailwind | transition + hover | 低 |
| 滚动触发动画 | Framer Motion | useInView + motion | 中 |
| 发光效果 | CSS | box-shadow + gradient | 低 |
| 按钮点击反馈 | Framer Motion | whileTap | 低 |

## 项目结构

```
app/
├── components/
│   ├── Sidebar.tsx          # 左侧导航栏
│   ├── Header.tsx           # 顶部Header
│   ├── MainTabs.tsx         # 主选项卡
│   ├── InputArea.tsx        # 输入框区域
│   ├── FeatureTags.tsx      # 功能标签
│   ├── CapabilityCards.tsx  # 能力卡片
│   └── CaseGallery.tsx      # 案例展示
├── hooks/
│   └── useScrollAnimation.ts # 滚动动画hook
├── lib/
│   └── utils.ts             # 工具函数
├── types/
│   └── index.ts             # 类型定义
├── page.tsx                 # 主页面
├── layout.tsx               # 根布局
└── globals.css              # 全局样式
components/ui/               # shadcn/ui 组件
public/
└── images/                  # 图片资源
```

## 依赖项

### 核心依赖
- `next` - Next.js 框架
- `react` - React
- `typescript` - TypeScript
- `tailwindcss` - Tailwind CSS

### UI 组件
- `@radix-ui/*` - Radix UI 基础组件
- `class-variance-authority` - 组件变体
- `clsx` / `tailwind-merge` - 类名合并

### 动画库
- `framer-motion` - 主要动画库

### 图标
- `lucide-react` - 图标库

## 颜色配置 (tailwind.config.ts)

```typescript
colors: {
  background: '#0a0a0f',
  card: '#14141a',
  border: '#27272a',
  primary: {
    DEFAULT: '#8b5cf6',
    foreground: '#ffffff',
  },
  secondary: {
    DEFAULT: '#ec4899',
    foreground: '#ffffff',
  },
  muted: {
    DEFAULT: '#71717a',
    foreground: '#a1a1aa',
  },
}
```

## 关键实现细节

### 1. 渐变背景
使用 Tailwind 的渐变工具类:
```
bg-gradient-to-r from-violet-600/20 to-purple-600/10
```

### 2. 发光效果
使用自定义 box-shadow:
```css
.glow-purple {
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.2);
}
```

### 3. 玻璃态效果
```css
.glass {
  background: rgba(20, 20, 26, 0.8);
  backdrop-filter: blur(10px);
}
```

### 4. 卡片悬停动画
```tsx
<motion.div
  whileHover={{ 
    y: -4, 
    borderColor: 'rgba(139, 92, 246, 0.3)',
    transition: { duration: 0.3 }
  }}
>
```

### 5. 页面入场动画
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
>
```
