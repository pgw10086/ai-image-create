import type { SuiteTemplate } from '@/types/suite';
import { createMockImageDataUri } from '@/lib/mockImage';

export const suiteTemplates: SuiteTemplate[] = [
  {
    id: 'suite-3c-digital',
    name: '3C 数码套图',
    description: '覆盖主图、侧视与使用场景，适合耳机/手表/小家电等。',
    coverImage:
      createMockImageDataUri({ title: '3C 数码套图', subtitle: '套图模版', width: 1200, height: 675 }),
    items: [
      {
        id: 'front',
        name: '正视主图',
        promptSuffix:
          ', product photography, hero shot, centered composition, studio lighting, clean background',
        referenceWeight: 0.9,
      },
      {
        id: 'side',
        name: '侧视图',
        promptSuffix:
          ', side view, product photography, studio lighting, clean background, sharp details',
        referenceWeight: 0.85,
      },
      {
        id: 'scene',
        name: '使用场景',
        promptSuffix:
          ', lifestyle scene, natural lighting, realistic environment, shallow depth of field, product in use',
        referenceWeight: 0.75,
      },
    ],
  },
  {
    id: 'suite-shoes',
    name: '鞋靴全能套图',
    description: '主图 + 侧视 + 细节 + 上脚场景，强调材质与轮廓。',
    coverImage:
      createMockImageDataUri({ title: '鞋靴全能套图', subtitle: '套图模版', width: 1200, height: 675 }),
    items: [
      {
        id: 'hero',
        name: '主图',
        promptSuffix:
          ', product photography, hero shot, centered, studio lighting, clean background, high detail',
        referenceWeight: 0.9,
      },
      {
        id: 'angle',
        name: '侧视角度',
        promptSuffix:
          ', side view, dynamic angle, product photography, studio lighting, high detail',
        referenceWeight: 0.85,
      },
      {
        id: 'detail',
        name: '细节特写',
        promptSuffix:
          ', macro detail shot, material texture, stitching, high detail, studio lighting',
        referenceWeight: 0.8,
      },
      {
        id: 'on-foot',
        name: '上脚场景',
        promptSuffix:
          ', on-foot lifestyle, street style, natural lighting, shallow depth of field, realistic',
        referenceWeight: 0.7,
      },
    ],
  },
];
