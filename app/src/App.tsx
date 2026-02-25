import { motion } from 'framer-motion';
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
import defaultSmartLayoutTemplatesRaw from '@/default-smart-layout-templates/smart-layout-templates-1770704133755.json?raw';
import { ensureDefaultSmartLayoutTemplatesImported } from '@/lib/smartLayoutPersistence';

ensureDefaultSmartLayoutTemplatesImported({
  raw: defaultSmartLayoutTemplatesRaw,
  sourceId: 'smart-layout-templates-1770704133755.json@v3',
});

function App() {
  const { activeTab, domesticMode, smartLayoutFocusMode } = useAppStore();
  const isSmartLayoutFocus = activeTab === 'smart_layout' && smartLayoutFocusMode;

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
      <main className={isSmartLayoutFocus ? "flex-1 ml-16 h-screen overflow-hidden" : "flex-1 ml-16"}>
        {/* Header */}
        {!isSmartLayoutFocus && <Header />}

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={isSmartLayoutFocus ? "w-full h-full" : "px-6 pb-8 w-full max-w-[1400px] mx-auto"}
        >
          {/* Main Tabs */}
          {!isSmartLayoutFocus && <MainTabs />}

          {activeTab === 'smart_layout' ? (
            <>
              {isSmartLayoutFocus ? (
                <SmartLayoutView className="h-full rounded-none border-0" />
              ) : (
                <>
                  <FeatureTags />
                  <div className="mt-6">
                    <SmartLayoutView />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <DomesticModeSwitch />

              {/* Input Area */}
              {domesticMode === 'single' ? <InputArea /> : <SuiteGeneratorView />}

              {/* Feature Tags */}
              {domesticMode === 'single' ? <FeatureTags /> : null}

              {/* Generated Gallery */}
              {domesticMode === 'single' ? <GeneratedGallery /> : <SuiteResultView />}

              {/* Case Gallery */}
              <CaseGallery />
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
