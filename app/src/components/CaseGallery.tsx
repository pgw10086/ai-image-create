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
    image: '/images/product-details.jpg',
    title: '商品详情图',
    description:
      '通用电商商品详情图模板，强调主体展示、细节特写与信息分区，适用于亚马逊等跨境电商详情页复用。',
    promptTemplate: `生成一张通用商品详情海报，产品为【你的商品名】。
整体风格：清晰克制的电商详情风，画面干净明亮。
色彩方案：以商品主色为核心，辅以中性色，保证信息可读性。
构图与版式：
1）顶部预留标题区，保留足够留白用于品牌与主标题；
2）中部展示商品主体与核心使用场景，突出外观、材质与卖点；
3）底部放置三个细节特写，分别体现材质工艺、关键结构、使用细节。
文案建议：Core Feature / Material Detail / Usage Highlight。
字体建议：现代无衬线或简洁衬线，颜色使用深灰或与商品主色协调的强调色。
输出要求：商业级清晰度，主体边缘清晰，光影自然，禁止 logo、水印、随机文字与杂乱背景。`,
    tags: ['通用商品', '详情页模板', '高复用'],
  },
  {
    id: 'hair-organizer-template',
    image: '/images/case-poster.jpg',
    title: '宣传海报图',
    description:
      '通用商品宣传海报模板，突出品牌主视觉、核心卖点与场景氛围，可复用到不同类目商品。',
    promptTemplate: `生成一张高转化电商宣传海报图，产品为【你的商品名】。
整体风格：品牌化、视觉聚焦明确、信息层级清晰，画面干净通透。
色彩方案：以商品与品牌主色为核心，搭配对比强调色，突出标题与卖点。
构图与版式：
1）上方放置品牌与主标题，保证强识别与可读性；
2）中部突出商品主体与英雄镜头，重点呈现外观、材质与核心卖点；
3）下方放置三条卖点信息或行动引导，形成完整转化链路。
文案建议：Hero Product / Key Benefit / Limited Offer。
字体建议：现代无衬线，标题大字号，正文中等字号，强调信息对比。
输出要求：商业级清晰度，主体边缘清晰，光影自然，禁止 logo、水印、随机文字与杂乱背景。`,
    tags: ['宣传海报', '品牌视觉', '高复用'],
  },
];

export function CaseGallery() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const { setInputValue, setInputTemplatePreset, addTask, updateTaskStatus } = useAppStore();

  const handleUseTemplate = (template: TemplateItem) => {
    setSelectedTemplate(null);
    if (template.id === 'bow-detail-template') {
      setInputTemplatePreset('bow-detail');
      toast.success('已加载商品详情图变量模板');
      return;
    }
    if (template.id === 'hair-organizer-template') {
      setInputTemplatePreset('hair-organizer');
      toast.success('已加载宣传海报图变量模板');
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
