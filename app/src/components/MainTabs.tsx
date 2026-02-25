import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

interface Tab {
  id: 'crossborder' | 'smart_layout';
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
}

const tabs: Tab[] = [
  {
    id: 'crossborder',
    title: '跨境设计',
    subtitle: '国际化审美 + 多语言适配，轻松应对海外平台发品需求',
    description: '',
  },
  {
    id: 'smart_layout',
    title: '智能布局',
    subtitle: '自由绘制区域，精准控制构图',
    description: '',
    badge: 'NEW',
  },
];

export function MainTabs() {
  const { activeTab, setActiveTab, updateGenerationContext } = useAppStore();
  const uiActiveTab = activeTab === 'smart_layout' ? 'smart_layout' : 'crossborder';

  const handleTabChange = (tabId: 'crossborder' | 'smart_layout') => {
    if (tabId === 'crossborder') {
      setActiveTab('detail');
      updateGenerationContext({ scene: 'crossborder' });
    } else {
      setActiveTab('smart_layout');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-pink-900/20" />
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent" />
      
      {/* Content */}
      <div className="relative p-6">
        <div className="flex gap-8">
          {tabs.map((tab) => {
            const isActive = uiActiveTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 text-left p-4 rounded-xl transition-all duration-300 relative ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl border border-violet-500/50 bg-gradient-to-r from-violet-600/20 to-purple-600/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-lg font-semibold ${isActive ? 'text-white' : 'text-white/70'}`}>
                      {tab.title}
                    </h3>
                    {tab.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-600/30 text-violet-300 border border-violet-500/30">
                        {tab.badge}
                      </span>
                    )}
                    <Info className={`w-4 h-4 ${isActive ? 'text-violet-400' : 'text-white/40'}`} />
                  </div>
                  <p className={`text-sm ${isActive ? 'text-white/80' : 'text-white/50'}`}>
                    {tab.subtitle}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
