import type { SuiteShotDefinition } from '@/types/suite';

export const SUITE_SHOTS: SuiteShotDefinition[] = [
  {
    id: 'bow-standard-product',
    name: '标准产品图',
    description: '双蝴蝶结对称陈列，突出产品质感与电商主图干净度。',
    defaultPromptSuffixZh:
      '商业产品摄影，两个{BOW_PRODUCT}对称地摆放在纯粉色的背景上。左上角有少量粉色花朵作为点缀，略微失焦。整体画面干净明亮，光线柔和均匀，高清细节，极简主义风格。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'bow-model-portrait',
    name: '模特效果图',
    description: '儿童模特佩戴效果，强调佩戴场景与情绪感染力。',
    defaultPromptSuffixZh:
      '一位可爱的金发小女孩，发型是双丸子头，佩戴着{BOW_PRODUCT}。她正对着镜头甜美地微笑。场景在室外花园，背景有美丽的散景效果。采用自然光，色调温暖，高质量人像特写。',
    defaultRatioMode: '3:4',
    defaultImageCount: 1,
  },
  {
    id: 'bow-size-reference',
    name: '尺寸参考图',
    description: '手掌托举展示尺寸，便于用户快速建立实际大小认知。',
    defaultPromptSuffixZh:
      '一只干净的手，手掌向上轻轻托着一个{BOW_PRODUCT}，用于直观展示产品的尺寸。背景是纯粉色的。光线明亮，焦点清晰，能看到产品的精致细节，商业摄影风格。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'bow-size-annotated',
    name: '尺寸标注图',
    description: '平铺展示并带横纵尺寸标注线，直观传达实际规格。',
    defaultPromptSuffixZh:
      '一只{BOW_PRODUCT}平铺在浅米粉背景中央，居中构图，中心有珍珠装饰。添加清晰的尺寸标注线与文字：横向标注 8.5cm/3.35inch，纵向标注 6.5cm/2.56inch。标注风格简洁专业，黑色细线与文字，画面干净，细节清晰，电商尺寸说明图风格。',
    defaultRatioMode: '3:4',
    defaultImageCount: 1,
  },
  {
    id: 'bow-wig-reference',
    name: '假发参考图',
    description: '浅金色假发佩戴展示，突出真实佩戴位置与发丝质感。',
    defaultPromptSuffixZh:
      '背面视角的假发展示图，浅金色发丝铺满画面，一只{BOW_PRODUCT}固定在头发中部位置，中心珍珠清晰可见。背景为浅米色，光线柔和均匀，画面干净，细节清晰，电商佩戴参考图风格。',
    defaultRatioMode: '16:9',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-white-product',
    name: '白色产品白底图',
    description: '纯白背景商品主图，强调金属质感与电商展示清晰度。',
    defaultPromptSuffixZh:
      '专业的电商产品摄影，{JEWELRY_PRODUCT}，纯白色背景，极简主义，影棚光，8k分辨率，超高清，突出{STORAGE_SELLING_POINTS_CN}。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-size-annotated',
    name: '尺寸标注图',
    description: '30-45度结构展示，带标注线，突出尺寸信息与结构清晰度。',
    defaultPromptSuffixZh:
      '一款{JEWELRY_PRODUCT}置于浅米白背景中央，30-45 度正侧视角，居中构图，仅保留产品主体，无饰品挂件与杂物。添加清晰的尺寸标注线与文字：横向总宽 26cm/10.24inch，纵向总高 32cm/12.60inch，底座深度 12cm/4.72inch。标注风格简洁专业，黑色细线与文字，箭头清晰，画面干净，细节锐利，电商尺寸说明图风格。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-product-scene',
    name: '产品场景图',
    description: '桌面静物生活方式场景，不出镜人物，突出家居氛围与收纳质感。',
    defaultPromptSuffixZh:
      '生活方式产品摄影，明亮干净的{STORAGE_USAGE_SCENE_CN}，{JEWELRY_PRODUCT}作为画面主体置于中央，展示收纳物品：{STORAGE_ITEMS_CN}。自然侧光，柔和阴影，色调温暖克制，构图整洁，真实高端电商场景图风格，无人物出镜，无杂乱背景。',
    defaultRatioMode: '16:9',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-model-scene',
    name: '模特场景图',
    description: '卧室梳妆台生活方式场景，营造高品质真实氛围。',
    defaultPromptSuffixZh:
      '生活方式摄影，人物与{JEWELRY_PRODUCT}同框展示，场景为{STORAGE_USAGE_SCENE_CN}，收纳内容为{STORAGE_ITEMS_CN}，突出“{STORAGE_SELLING_POINTS_CN}”。自然光线，柔和色调，真实感。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-feature-breakdown',
    name: '功能卖点分解图',
    description: '中心主体+留白信息区，适合功能卖点图文拆解。',
    defaultPromptSuffixZh:
      '正面视图，图像中央是{JEWELRY_PRODUCT}，围绕“{STORAGE_SELLING_POINTS_CN}”做功能卖点分解，周围预留充足留白用于图标和指示线。明亮均匀的影棚光，高分辨率，电商产品功能卖点分解图。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-category-showcase',
    name: '收纳品类展示图',
    description: '信息图布局，展示可收纳的饰品与小物品类目。',
    defaultPromptSuffixZh:
      '一张高端电商产品详情主图，主题为“{STORAGE_CATEGORY_CN}收纳”。采用明确的左右构图：左侧展示{JEWELRY_PRODUCT}主体；右侧是白色信息面板，标题“{STORAGE_TITLE_EN}”，并展示英文品类标签：{STORAGE_CATEGORY_LABELS_EN}。整体风格为干净柔和背景、均匀明亮光线、极简商业摄影质感，突出信息图与产品的对应关系。',
    defaultRatioMode: '16:9',
    defaultImageCount: 1,
  },
  {
    id: 'jewelry-rack-gift-scene-collage',
    name: '礼赠场景拼图',
    description: '左产品右生活方式拼图，强调节日送礼与家庭情感氛围。',
    defaultPromptSuffixZh:
      '一张高端电商详情图，采用左窄右宽分栏。左侧为{JEWELRY_PRODUCT}实拍图，展示收纳内容：{STORAGE_ITEMS_CN}。右侧为三宫格生活方式拼图，强调送礼场景与家庭互动。整体叠加文案“Nice Gift”，统一干净柔和背景与柔和光线，突出“{STORAGE_SELLING_POINTS_CN}，适合作为礼物”的卖点。',
    defaultRatioMode: '16:9',
    defaultImageCount: 1,
  },
  {
    id: 'front',
    name: '正视主图',
    description: '主体居中、纯净背景，适合电商主图与封面。',
    defaultPromptSuffixZh:
      '正视角度，主体居中，棚拍质感，柔和打光，清晰细节，干净背景，真实阴影，画面简洁，突出主体。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'side',
    name: '侧视图',
    description: '强调侧面结构与轮廓，适合展示厚度/接口/侧面细节。',
    defaultPromptSuffixZh:
      '侧视角度，突出产品侧面结构与轮廓，棚拍质感，清晰细节，干净背景，真实阴影，画面简洁。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'angle45',
    name: '45° 角度',
    description: '更立体、更有动感，常用于展示造型与质感。',
    defaultPromptSuffixZh:
      '45度斜侧视角，立体感强，突出造型与材质质感，棚拍质感，清晰细节，干净背景，真实阴影。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'detail',
    name: '细节特写',
    description: '突出材质纹理、做工、按钮/缝线等局部信息。',
    defaultPromptSuffixZh:
      '细节特写，微距视角，突出材质纹理与工艺细节，清晰锐利，棚拍质感，干净背景，避免过度虚化遮挡关键细节。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'scene',
    name: '使用场景',
    description: '生活方式场景，自然光，更贴近真实使用。',
    defaultPromptSuffixZh:
      '使用场景，生活方式场景，自然光，真实环境，浅景深，产品被自然使用，画面干净，突出主体。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'on-foot',
    name: '上脚场景',
    description: '适用于鞋靴，强调上脚效果与穿搭氛围。',
    defaultPromptSuffixZh:
      '上脚场景，街头或室内自然光，真实穿搭，突出鞋靴轮廓与材质，浅景深，画面干净，避免遮挡主体。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'in-hand',
    name: '手持展示',
    description: '增强尺度感与使用感，适合小家电/3C。',
    defaultPromptSuffixZh:
      '手持展示，强调尺度与握持方式，肤色自然，光线柔和，背景简洁，突出主体与关键细节，避免夸张姿势。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'scale-reference',
    name: '尺度对比',
    description: '通过手部/常见物体做参照，直观体现产品大小。',
    defaultPromptSuffixZh:
      '尺度对比图，加入真实参照物（手掌、硬币、手机或桌面常见物），突出产品实际尺寸，构图简洁，细节清晰，背景干净。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'what-in-box',
    name: '包装清单',
    description: '平铺展示包装与配件，减少“到手不符”疑虑。',
    defaultPromptSuffixZh:
      '包装清单平铺图，展示产品本体与全部配件，摆放整齐，层级清晰，背景干净，光线均匀，避免缺件或遮挡。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'feature-callout',
    name: '卖点信息图',
    description: '突出核心功能卖点，适合详情页模块化呈现。',
    defaultPromptSuffixZh:
      '卖点信息图风格，突出1-3个核心功能点，结构化构图，预留简洁文案区，避免花哨贴纸与拥挤元素，主体清晰。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'comparison',
    name: '对比展示',
    description: '与竞品/旧款/常见替代方案对比，突出优势。',
    defaultPromptSuffixZh:
      '对比展示图，同场景下突出目标产品优势（尺寸、结构、性能或收纳效果），信息清晰，画面简洁，避免夸张失真。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'usage-step',
    name: '使用步骤',
    description: '步骤化呈现安装/使用流程，降低理解门槛。',
    defaultPromptSuffixZh:
      '使用步骤图，分步骤展示安装或使用流程，动作自然，顺序清晰，背景干净，突出关键操作区域。',
    defaultRatioMode: '3:4',
    defaultImageCount: 1,
  },
  {
    id: 'before-after',
    name: '前后对比',
    description: '适合清洁、护理、收纳类，强调结果变化。',
    defaultPromptSuffixZh:
      '前后对比场景，左前右后或上下分区，变化真实可信，光线一致，画面干净，突出效果差异。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
  {
    id: 'color-variants',
    name: '颜色款式',
    description: '同款多色或多规格并排展示，便于用户决策。',
    defaultPromptSuffixZh:
      '颜色或款式展示图，同一产品多色多款并排陈列，色彩准确，间距整齐，避免遮挡主体，整体风格统一。',
    defaultRatioMode: '1:1',
    defaultImageCount: 1,
  },
  {
    id: 'material-closeup',
    name: '材质工艺',
    description: '强调面料/纹理/做工细节，增强品质感。',
    defaultPromptSuffixZh:
      '材质工艺特写，微距展示纹理、缝线、接口或表面处理细节，锐利清晰，光线柔和，避免过度磨皮与失真。',
    defaultRatioMode: '4:3',
    defaultImageCount: 1,
  },
];

export function getSuiteShotById(shotId: string) {
  return SUITE_SHOTS.find((s) => s.id === shotId);
}
