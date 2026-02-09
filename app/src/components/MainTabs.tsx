import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

interface Tab {
  id: 'crossborder' | 'domestic' | 'smart_layout';
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
    id: 'domestic',
    title: '中文电商（开发中）',
    subtitle: '正在开发中，敬请期待',
    description: '',
    badge: '敬请期待',
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
  const { activeTab, setActiveTab } = useAppStore();
  // Map store tab to UI tab
  const uiActiveTab = activeTab === 'detail' ? 'crossborder' : (activeTab === 'smart_layout' ? 'smart_layout' : 'domestic');
  const isTabDisabled = (tabId: 'crossborder' | 'domestic' | 'smart_layout') => tabId === 'domestic';

  const handleTabChange = (tabId: 'crossborder' | 'domestic' | 'smart_layout') => {
    if (tabId === 'crossborder') {
      setActiveTab('detail');
    } else if (tabId === 'smart_layout') {
      setActiveTab('smart_layout');
    } else {
      setActiveTab('single');
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
            const disabled = isTabDisabled(tab.id);
            const isActive = uiActiveTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={disabled ? undefined : () => handleTabChange(tab.id)}
                className={`flex-1 text-left p-4 rounded-xl transition-all duration-300 relative ${
                  isActive ? 'bg-white/10' : (disabled ? 'bg-white/0' : 'hover:bg-white/5')
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                whileHover={disabled ? undefined : { scale: 1.01 }}
                whileTap={disabled ? undefined : { scale: 0.99 }}
              >
                {isActive && !disabled && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl border border-violet-500/50 bg-gradient-to-r from-violet-600/20 to-purple-600/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-lg font-semibold ${isActive && !disabled ? 'text-white' : 'text-white/70'}`}>
                      {tab.title}
                    </h3>
                    {tab.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-600/30 text-violet-300 border border-violet-500/30">
                        {tab.badge}
                      </span>
                    )}
                    <Info className={`w-4 h-4 ${isActive && !disabled ? 'text-violet-400' : 'text-white/40'}`} />
                  </div>
                  <p className={`text-sm ${isActive && !disabled ? 'text-white/80' : 'text-white/50'}`}>
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
