import type { SuiteTemplate } from '@/types/suite';
import { createMockImageDataUri } from '@/lib/mockImage';

export const suiteTemplates: SuiteTemplate[] = [
  {
    id: 'suite-detail-page',
    name: '详情页套图',
    description: '适合电商详情页：主图 + 多角度 + 细节特写 + 场景图。',
    coverImage:
      createMockImageDataUri({ title: '详情页套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'side', 'detail', 'scene', 'in-hand'],
    defaultShotIds: ['front', 'angle45', 'detail', 'scene'],
  },
  {
    id: 'suite-brand-kv',
    name: '品牌视觉套图',
    description: '适合品牌统一风格：质感主图 + KV 场景 + 材质细节。',
    coverImage:
      createMockImageDataUri({ title: '品牌视觉套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'detail', 'scene'],
    defaultShotIds: ['angle45', 'scene', 'detail'],
  },
  {
    id: 'suite-3c-digital',
    name: '3C 数码套图',
    description: '覆盖主图、侧视与使用场景，适合耳机/手表/小家电等。',
    coverImage:
      createMockImageDataUri({ title: '3C 数码套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'side', 'angle45', 'detail', 'scene', 'in-hand'],
    defaultShotIds: ['front', 'side', 'scene'],
  },
  {
    id: 'suite-shoes',
    name: '鞋靴全能套图',
    description: '主图 + 侧视 + 细节 + 上脚场景，强调材质与轮廓。',
    coverImage:
      createMockImageDataUri({ title: '鞋靴全能套图', subtitle: '套图模版', width: 1200, height: 675 }),
    availableShotIds: ['front', 'angle45', 'side', 'detail', 'on-foot', 'scene'],
    defaultShotIds: ['front', 'angle45', 'detail', 'on-foot'],
  },
];
