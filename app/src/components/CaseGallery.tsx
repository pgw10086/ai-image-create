import { motion } from 'framer-motion';
import { Download, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import { toast } from 'sonner';

interface TemplateItem {
  id: string;
  image: string;
  title: string;
  description: string;
  promptTemplate: string;
  tags: string[];
}

const templates: TemplateItem[] = [
  {
    id: 'bow-detail-template',
    image: '/images/case-bow.jpg',
    title: '蝴蝶结商品详情图',
    description:
      '梦幻母婴风详情模板，聚焦蝴蝶结缎面高光、工艺细节与场景化展示，适用于亚马逊等跨境电商详情页主图延展。',
    promptTemplate: `生成一张蝴蝶结商品详情海报，竖版 3:4，产品为粉蓝配色蝴蝶结挂旗。
整体风格：清新轻奢、少女感但不幼稚，画面干净明亮。
色彩方案：马卡龙蓝、樱花粉、纯白，保持高级和谐。
构图与版式：
1）顶部预留标题区，采用浅蓝几何/波浪区块，保留留白；
2）中部以白色法式壁炉为主场景，展示粉蓝蝴蝶结弧线挂旗与真实悬挂效果；
3）底部放置三个圆形细节特写，分别体现背面结构、燕尾尾部设计、丝缎光泽（手持展示）。
文案建议：Back View / Swallowtail-tail Design / Soft Silky Luster。
字体建议：现代衬线或优雅斜体衬线，颜色使用深灰蓝，整体质感偏精品电商海报。
输出要求：柔和漫射日光，阴影轻，丝缎高光细腻、褶皱自然、边缘整齐，商业级清晰度，禁止 logo、水印、随机文字与杂乱背景。`,
    tags: ['母婴派对', '详情页模板', '丝带质感'],
  },
  {
    id: 'hair-organizer-template',
    image: '/images/case-hair-organizer.jpg',
    title: '发饰置物架商品图',
    description:
      '儿童房生活方式模板，突出墙挂式发饰收纳架的分层陈列、真实家居场景与人群适配，适用于跨境电商详情页主图与横幅。',
    promptTemplate: `生成一张高转化电商商品详情图，产品为女孩发饰置物架（墙挂式发夹发带收纳架）。
整体风格：北欧奶油风、温暖亲子生活方式、自然柔光摄影，画面干净通透。
色彩方案：奶油白、浅木色、马卡龙粉彩发饰点缀，整体柔和高级。
构图与版式：
1）左侧保留大面积信息区，适合放置品牌与标题文案；
2）中部展示墙挂式发饰置物架，重点表现分层收纳结构、蝴蝶结与发带整齐陈列；
3）右侧展示儿童房柜体与小女孩场景，强化产品使用人群与家居适配氛围。
文案建议：Hair Accessory Organizer for Girls / Multi-layer Storage / Neat & Easy Access。
字体建议：圆润无衬线，深暖灰色，标题大字号，整体偏母婴精品海报。
输出要求：商业级清晰度，材质与光影真实自然，布料细节清晰，禁止 logo、水印、随机文字与杂乱背景。`,
    tags: ['儿童房场景', '收纳卖点', '生活方式'],
  },
];

export function CaseGallery() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const { setInputValue, setInputTemplatePreset, addTask, updateTaskStatus } = useAppStore();

  const handleUseTemplate = (template: TemplateItem) => {
    setSelectedTemplate(null);
    if (template.id === 'bow-detail-template') {
      setInputTemplatePreset('bow-detail');
      toast.success('已加载蝴蝶结变量模板');
      return;
    }
    if (template.id === 'hair-organizer-template') {
      setInputTemplatePreset('hair-organizer');
      toast.success('已加载发饰置物架变量模板');
      return;
    }
    setInputTemplatePreset('none');
    setInputValue(template.promptTemplate);
    toast.success('已加载模板到输入框');
  };

  const handleGenerateSimilar = async () => {
    if (!selectedTemplate) return;

    const template = selectedTemplate;
    setSelectedTemplate(null);

    const newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'single',
      status: 'processing',
      createdAt: Date.now(),
      input: {
        prompt: `类似${template.title}风格`,
        referenceImages: [template.image],
        model: 'doubao-seedream-4-5-251128',
      },
    };

    addTask(newTask);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    updateTaskStatus(newTask.id, 'success', {
      images: [{ url: template.image, prompt: newTask.input.prompt }],
    });

    toast.success('图片生成成功！');
  };

  const handleDownload = () => {
    if (!selectedTemplate) return;

    const link = document.createElement('a');
    link.href = selectedTemplate.image;
    link.download = `${selectedTemplate.title}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('图片下载中...');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="mt-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-200 text-sm font-medium border border-violet-400/25">
            模板库
          </span>
          <span className="text-white/45 text-sm">精选高转化模板，可一键套用</span>
        </div>

        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/10 via-card/80 to-card/60 p-4 md:p-5"
            >
              <div className="grid gap-4 md:grid-cols-[320px_1fr] items-stretch">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedTemplate(template)}
                  className="relative overflow-hidden rounded-2xl border border-white/10 aspect-square text-left"
                >
                  <img
                    src={template.image}
                    alt={template.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute left-3 right-3 bottom-3">
                    <p className="text-white font-medium text-sm">{template.title}</p>
                    <p className="text-white/70 text-xs mt-1">点击查看模板详情</p>
                  </div>
                </motion.button>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5 flex flex-col">
                  <div className="flex items-center gap-2 text-violet-200 mb-2">
                    <Wand2 className="w-4 h-4" />
                    <span className="text-sm font-medium">模板说明</span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">{template.title}</h3>
                  <p className="text-white/65 text-sm leading-6">{template.description}</p>

                  <div className="flex flex-wrap gap-2 mt-4 mb-5">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs bg-violet-600/20 text-violet-200 border border-violet-500/30"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleUseTemplate(template)}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      一键套用模板
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/15 hover:bg-white/5"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      查看模板详情
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="w-[min(94vw,960px)] max-w-[960px] bg-card border-border p-0 overflow-hidden">
          {selectedTemplate && (
            <div className="grid md:grid-cols-[1.05fr_1fr] max-h-[85vh]">
              <div className="aspect-square md:aspect-auto md:h-full bg-black/20">
                <img
                  src={selectedTemplate.image}
                  alt={selectedTemplate.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-6 flex flex-col min-w-0 overflow-y-auto">
                <DialogTitle className="text-xl font-semibold text-white mb-2 pr-8 leading-tight">
                  {selectedTemplate.title}
                </DialogTitle>
                <DialogDescription className="sr-only">查看模板详情并执行相关操作</DialogDescription>
                <p className="text-white/60 text-sm mb-4 leading-6">{selectedTemplate.description}</p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedTemplate.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full text-xs bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto space-y-2">
                  <Button
                    onClick={() => handleUseTemplate(selectedTemplate)}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    使用此模板
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerateSimilar}
                    className="w-full border-white/10 hover:bg-white/5"
                  >
                    生成类似图片
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDownload}
                    className="w-full text-white/60 hover:text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载原图
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
