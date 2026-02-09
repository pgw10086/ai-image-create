import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

export function Header() {
  const { credits, activeTab, smartLayoutFocusMode } = useAppStore();
  const showCredits = activeTab !== 'smart_layout' && !smartLayoutFocusMode;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      className="h-16 flex items-center justify-end px-6 gap-3"
    >
      {showCredits && (
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30 cursor-pointer"
        >
          <Zap className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-violet-200">{credits}</span>
        </motion.div>
      )}
    </motion.header>
  );
}
