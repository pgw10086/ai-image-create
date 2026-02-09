import { motion } from 'framer-motion';
import { Images, Heart, Check, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { toast } from 'sonner';

interface Capability {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ElementType;
  gradient: string;
  painPoint: string;
}

const capabilities: Capability[] = [
  {
    id: 'detail',
    title: '详情页',
    description: '一次生成多张关联图片',
    badge: '批量生成',
    icon: Images,
    gradient: 'from-violet-600/20 to-purple-600/10',
    painPoint: '制图效率低下',
  },
  {
    id: 'brand',
    title: '品牌模型',
    description: '打造专属品牌风格的图片内容',
    badge: '专属定制',
    icon: Heart,
    gradient: 'from-blue-600/20 to-cyan-600/10',
    painPoint: '品牌视觉统一性',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.5,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function CapabilityCards() {
  const { setActiveTab, setInputValue } = useAppStore();

  const handleCardClick = (cap: Capability) => {
    switch (cap.id) {
      case 'detail':
        setActiveTab('detail');
        toast.success('已切换至详情页模式');
        break;
      case 'brand':
        setInputValue('生成品牌风格统一的产品图片系列');
        toast.success('已加载品牌模型提示');
        break;
    }
  };

  return (
    <div className="mt-10">
      {/* Section Title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex items-center justify-center gap-2 mb-6"
      >
        <span className="text-white/40 text-sm">平</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">台</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">能</span>
        <span className="text-white/20">•</span>
        <span className="text-white/40 text-sm">力</span>
      </motion.div>

      {/* Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-4"
      >
        {capabilities.map((cap) => {
          const Icon = cap.icon;

          return (
            <motion.div
              key={cap.id}
              variants={cardVariants}
              whileHover={{
                y: -4,
                transition: { duration: 0.3 },
              }}
              onClick={() => handleCardClick(cap)}
              className={`relative p-5 rounded-2xl bg-gradient-to-br ${cap.gradient} border border-white/10 cursor-pointer group overflow-hidden`}
            >
              {/* Hover Border Effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-violet-500/0 group-hover:border-violet-500/30 transition-colors duration-300"
              />

              {/* Badge */}
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white/10 text-white/70 border border-white/10">
                  {cap.badge}
                </span>
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-white/80" />
              </div>

              {/* Content */}
              <h3 className="text-white font-medium text-base mb-1">{cap.title}</h3>
              <p className="text-white/50 text-sm mb-3">{cap.description}</p>

              {/* Pain Point */}
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <Check className="w-3 h-3 text-violet-400" />
                <span>解决痛点：{cap.painPoint}</span>
              </div>

              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-violet-400" />
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
