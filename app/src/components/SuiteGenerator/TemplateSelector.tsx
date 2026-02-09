import { motion } from 'framer-motion';
import { suiteTemplates } from '@/constants/templates';
import type { SuiteTemplate } from '@/types/suite';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TemplateSelector({
  onSelect,
  selectedTemplateId,
}: {
  onSelect: (template: SuiteTemplate) => void;
  selectedTemplateId?: string | null;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-sm font-medium border border-violet-500/30">
            套图模版
          </span>
          <span className="text-white/50 text-sm">选择一个模版开始配置</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suiteTemplates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          return (
            <motion.button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="text-left"
            >
              <Card
                className={`overflow-hidden border transition-colors ${
                  isSelected ? 'border-violet-500/60' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="relative aspect-[16/9] bg-card">
                  <img src={tpl.coverImage} alt={tpl.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{tpl.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/70 border border-white/10">
                      {tpl.items.length} 张
                    </span>
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  <CardDescription className="text-white/60">{tpl.description}</CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 text-white/60 border border-white/10"
                      >
                        {it.name}
                      </span>
                    ))}
                    {tpl.items.length > 4 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 text-white/50 border border-white/10">
                        +{tpl.items.length - 4}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
