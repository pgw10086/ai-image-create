import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MainTabs } from './components/MainTabs';
import { InputArea } from './components/InputArea';
import { DomesticModeSwitch } from './components/DomesticModeSwitch';
import { FeatureTags } from './components/FeatureTags';
import { CaseGallery } from './components/CaseGallery';
import { GeneratedGallery } from './components/GeneratedGallery';
import { SmartLayoutView } from './components/SmartLayoutView';
import { SuiteGeneratorView } from './components/SuiteGenerator/SuiteGeneratorView';
import { SuiteResultView } from './components/SuiteGenerator/SuiteResultView';
import { useAppStore } from './store/appStore';
import defaultSmartLayoutTemplatesRaw from '@/default-smart-layout-templates/smart-layout-templates-1772010604008.json?raw';
import { ensureDefaultSmartLayoutTemplatesImported } from '@/lib/smartLayoutPersistence';

function hashStringDjb2(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

ensureDefaultSmartLayoutTemplatesImported({
  raw: defaultSmartLayoutTemplatesRaw,
  sourceId: `default-smart-layout-templates@${hashStringDjb2(defaultSmartLayoutTemplatesRaw)}`,
});

function App() {
  const { activeTab, domesticMode, smartLayoutFocusMode, singleTemplateUi } = useAppStore();
  const isSmartLayoutFocus = activeTab === 'smart_layout' && smartLayoutFocusMode;
  const isSingleTemplateSplitLayout = domesticMode === 'single' && singleTemplateUi.isApplied;
  const [isPreviewImageBroken, setIsPreviewImageBroken] = useState(false);

  useEffect(() => {
    setIsPreviewImageBroken(false);
  }, [singleTemplateUi.previewImage]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#14141a',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className={isSmartLayoutFocus ? "flex-1 ml-16 h-screen overflow-auto" : "flex-1 ml-16"}>
        {/* Header */}
        {!isSmartLayoutFocus && <Header />}

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={isSmartLayoutFocus ? "w-full min-h-full" : "px-6 pb-8 w-full max-w-[1400px] mx-auto"}
        >
          {/* Main Tabs */}
          {!isSmartLayoutFocus && <MainTabs />}

          {activeTab === 'smart_layout' ? (
            <>
              {!isSmartLayoutFocus ? <FeatureTags /> : null}
              <div className={isSmartLayoutFocus ? "" : "mt-6"}>
                <SmartLayoutView className={isSmartLayoutFocus ? "rounded-none border-0" : undefined} />
              </div>
            </>
          ) : (
            <>
              <DomesticModeSwitch />

              {domesticMode === 'single' ? (
                <>
                  {isSingleTemplateSplitLayout ? (
                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
                      <div className="min-w-0">
                        <InputArea />
                        <FeatureTags />
                        <GeneratedGallery />
                      </div>

                      <aside className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/10 via-card/80 to-card/60 p-4 xl:sticky xl:top-24">
                        <div className="text-xs uppercase tracking-wide text-violet-200/80">模板效果图</div>
                        <div className="mt-1 text-white/90 font-medium truncate">{singleTemplateUi.previewTitle || '模板预览'}</div>
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 overflow-hidden aspect-[4/3]">
                          {singleTemplateUi.previewImage && !isPreviewImageBroken ? (
                            <img
                              src={singleTemplateUi.previewImage}
                              alt={singleTemplateUi.previewTitle || '模板效果图'}
                              className="w-full h-full object-cover"
                              onError={() => setIsPreviewImageBroken(true)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-white/50">
                              模板预览不可用
                            </div>
                          )}
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <>
                      <InputArea />
                      <FeatureTags />
                      <GeneratedGallery />
                    </>
                  )}
                  <CaseGallery />
                </>
              ) : (
                <>
                  <SuiteGeneratorView />
                  <SuiteResultView />
                </>
              )}
            </>
          )}
        </motion.div>

        {/* Footer */}
        {!isSmartLayoutFocus && (
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="px-6 py-4 border-t border-border mt-auto"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <a
                href="https://beian.miit.gov.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
              </a>
            </div>
          </motion.footer>
        )}
      </main>
    </div>
  );
}

export default App;
