import { motion } from 'framer-motion';
import { Sparkles, Heart, FolderOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  icon: React.ElementType;
  label: string;
  id: string;
}

const navItems: NavItem[] = [
  { icon: Sparkles, label: '创意', id: 'creative' },
  { icon: Heart, label: '品牌', id: 'brand' },
  { icon: FolderOpen, label: '资产', id: 'assets' },
];

export function Sidebar() {
  return (
    <TooltipProvider delayDuration={100}>
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 h-screen w-16 bg-background border-r border-border flex flex-col items-center py-4 z-50"
      >
        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center mb-8 cursor-pointer"
        >
          <span className="text-white font-bold text-lg">泰</span>
        </motion.div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {navItems.map((item, index) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(139, 92, 246, 0.15)' }}
                  whileTap={{ scale: 0.95 }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-white transition-colors relative group"
                >
                  <item.icon className="w-5 h-5" />
                  {item.id === 'creative' && (
                    <span className="absolute right-1 top-1 w-2 h-2 bg-violet-500 rounded-full" />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card border-border">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </motion.aside>
    </TooltipProvider>
  );
}
