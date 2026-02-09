import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { useAppStore } from '@/store/appStore';

export function DomesticModeSwitch() {
  const { domesticMode, setDomesticMode, activeTab } = useAppStore();

  if (activeTab === 'smart_layout') return null;

  return (
    <div className="mt-6 flex items-center justify-between">
      <ButtonGroup className="bg-card/60 border border-white/10 rounded-xl p-1">
        <Button
          type="button"
          variant={domesticMode === 'single' ? 'default' : 'ghost'}
          className={domesticMode === 'single' ? 'bg-violet-600 hover:bg-violet-500' : ''}
          onClick={() => setDomesticMode('single')}
        >
          自由生成
        </Button>
        <Button
          type="button"
          variant={domesticMode === 'suite' ? 'default' : 'ghost'}
          className={domesticMode === 'suite' ? 'bg-violet-600 hover:bg-violet-500' : ''}
          onClick={() => setDomesticMode('suite')}
        >
          套图模版
        </Button>
      </ButtonGroup>
    </div>
  );
}

