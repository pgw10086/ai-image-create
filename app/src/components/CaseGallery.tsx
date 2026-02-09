import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import { toast } from 'sonner';

interface CaseItem {
  id: string;
  image: string;
  title: string;
  description: string;
  tags: string[];
}

const cases: CaseItem[] = [
  { 
    id: '1', 
    image: '/images/case-oven.jpg', 
    title: '智能烤箱',
    description: '专业厨房电器产品图，现代简约风格，适合亚马逊等跨境电商平台',
    tags: ['家电', '厨房', '亚马逊']
  },
  { 
    id: '2', 
    image: '/images/case-chips.jpg', 
    title: '零食包装',
    description: '休闲食品产品展示，清新自然风格，突出产品特色',
    tags: ['食品', '包装', '户外']
  },
  { 
    id: '3', 
    image: '/images/case-bag.jpg', 
    title: '时尚手提包',
    description: '奢侈品风格产品摄影，高端大气，适合品牌展示',
    tags: ['时尚', '奢侈品', '女包']
  },
  { 
    id: '4', 
    image: '/images/case-kettle.jpg', 
    title: '电热水壶',
    description: '现代家居电器，简约设计，适合多种电商平台',
    tags: ['家电', '厨房', '日亚']
  },
  { 
    id: '5', 
    image: '/images/case-headphone.jpg', 
    title: '无线耳机',
    description: '科技产品展示，炫酷灯光效果，适合数码产品推广',
    tags: ['数码', '耳机', '科技']
  },
];

export function CaseGallery() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const { setInputValue, addTask, updateTaskStatus, deductCredits } = useAppStore();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleUseCase = async (caseItem: CaseItem) => {
    setSelectedCase(null);
    setInputValue(`生成类似「${caseItem.title}」风格的产品图：${caseItem.description}`);
    toast.success('已加载案例模板');
  };

  const handleGenerateSimilar = async () => {
    if (!selectedCase) return;
    
    if (!deductCredits(10)) {
      toast.error('算力不足，请充值');
      return;
    }

    const currentCase = selectedCase; // Capture closure
    setSelectedCase(null);
    
    const newTask: GenerationTask = {
        id: Date.now().toString(),
        type: 'single',
        status: 'processing',
        createdAt: Date.now(),
        input: {
            prompt: `类似${currentCase.title}风格`,
            referenceImages: [currentCase.image],
            model: 'doubao-seedream-4-5-251128'
        }
    };
    addTask(newTask);
    
    // Simulate generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    updateTaskStatus(newTask.id, 'success', {
        images: [{ url: currentCase.image, prompt: newTask.input.prompt }]
    });
    
    toast.success('图片生成成功！');
  };

  const handleDownload = () => {
    if (!selectedCase) return;
    
    const link = document.createElement('a');
    link.href = selectedCase.image;
    link.download = `${selectedCase.title}.jpg`;
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
        {/* Section Title */}
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 text-sm font-medium border border-white/10">
            agent案例
          </span>
        </div>

        {/* Gallery Container */}
        <div className="relative group">
          {/* Left Arrow */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>

          {/* Right Arrow */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>

          {/* Scrollable Container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar pb-2"
          >
            {cases.map((caseItem, index) => (
              <motion.div
                key={caseItem.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedCase(caseItem)}
                className="flex-shrink-0 w-[240px] cursor-pointer group/card"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-card">
                  <img
                    src={caseItem.image}
                    alt={caseItem.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover/card:translate-y-0 transition-transform duration-300">
                    <p className="text-white font-medium text-sm">{caseItem.title}</p>
                    <p className="text-white/60 text-xs mt-1">点击查看详情</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
          {selectedCase && (
            <div className="flex">
              {/* Image */}
              <div className="w-1/2 aspect-square">
                <img
                  src={selectedCase.image}
                  alt={selectedCase.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Info */}
              <div className="w-1/2 p-6 flex flex-col">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {selectedCase.title}
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  {selectedCase.description}
                </p>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedCase.tags.map((tag) => (
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
                    onClick={handleUseCase.bind(null, selectedCase)}
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
                    生成类似图片 (10算力)
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
