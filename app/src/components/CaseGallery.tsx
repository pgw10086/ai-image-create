import { motion } from 'framer-motion';
import { Download, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
    promptTemplate: `请生成一张高转化电商商品详情图，产品为粉蓝配色蝴蝶结挂旗。
整体风格：清新梦幻、母婴派对氛围、高调柔光摄影，画面干净通透。
色彩方案：婴儿蓝、樱花粉、纯白，保持高级和谐。
版式建议：
1）顶部使用浅蓝波浪形区块并放置标题“PRODUCT DETAILS”；
2）中部展示产品在白色壁炉/派对布景中的真实悬挂效果；
3）底部放置三个圆形细节特写，分别体现背面做工、燕尾剪裁、丝滑光泽。
文字建议：Back View / Swallowtail Design / Soft Silky Luster。
字体建议：优雅手写体或现代斜体衬线，颜色使用深灰蓝，整体质感偏精品海报。
输出要求：商业级清晰度，材质与光影真实自然。`,
    tags: ['母婴派对', '详情页模板', '丝带质感'],
  },
];

export function CaseGallery() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const { setInputValue, setInputTemplatePreset, addTask, updateTaskStatus } = useAppStore();
  const currentTemplate = templates[0];

  const handleUseTemplate = (template: TemplateItem) => {
    setSelectedTemplate(null);
    if (template.id === 'bow-detail-template') {
      setInputTemplatePreset('bow-detail');
      toast.success('已加载蝴蝶结变量模板');
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

        <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/10 via-card/80 to-card/60 p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-[320px_1fr] items-stretch">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedTemplate(currentTemplate)}
              className="relative overflow-hidden rounded-2xl border border-white/10 aspect-square text-left"
            >
              <img
                src={currentTemplate.image}
                alt={currentTemplate.title}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute left-3 right-3 bottom-3">
                <p className="text-white font-medium text-sm">{currentTemplate.title}</p>
                <p className="text-white/70 text-xs mt-1">点击查看模板详情</p>
              </div>
            </motion.button>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5 flex flex-col">
              <div className="flex items-center gap-2 text-violet-200 mb-2">
                <Wand2 className="w-4 h-4" />
                <span className="text-sm font-medium">模板说明</span>
              </div>

              <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">{currentTemplate.title}</h3>
              <p className="text-white/65 text-sm leading-6">{currentTemplate.description}</p>

              <div className="flex flex-wrap gap-2 mt-4 mb-5">
                {currentTemplate.tags.map((tag) => (
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
                  onClick={() => handleUseTemplate(currentTemplate)}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  一键套用模板
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 hover:bg-white/5"
                  onClick={() => setSelectedTemplate(currentTemplate)}
                >
                  查看模板详情
                </Button>
              </div>
            </div>
          </div>
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
                <h3 className="text-xl font-semibold text-white mb-2 pr-8 leading-tight">{selectedTemplate.title}</h3>
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
