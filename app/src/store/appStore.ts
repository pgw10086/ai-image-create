import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SuiteGenerationResult } from '../types/suite';
import type { SmartLayoutAsset } from '@/types/smartLayout';

function hashStringFNV1a(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface GenerationTask {
  id: string;
  type: 'single' | 'suite' | 'layout';
  status: 'pending' | 'processing' | 'success' | 'failed';
  createdAt: number;
  input: {
    prompt: string;
    referenceImages: string[]; // 统一为数组
    model: string;
  };
  result?: {
    images?: { url: string; prompt: string }[];
    suite?: SuiteGenerationResult;
  };
  error?: string;
}

export interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export interface GenerationContext {
  platformId: string; // amazon/temu/shopee/...
  language: 'zh' | 'en';
  model: string;
  imageCount: number;
  ratioMode: string; // e.g. 智能比例 / 1:1 / 3:4 ...
  stylePreset?: string;
  scene?: string;
}

export interface AppState {
  // Active tab
  activeTab: 'detail' | 'single' | 'smart_layout';
  setActiveTab: (tab: 'detail' | 'single' | 'smart_layout') => void;
  
  domesticMode: 'single' | 'suite';
  setDomesticMode: (mode: 'single' | 'suite') => void;

  // Input
  inputValue: string;
  setInputValue: (value: string) => void;
  
  // Active tags
  activeTags: string[];
  toggleTag: (tagId: string) => void;

  // Global generation context (used by smart layout)
  generationContext: GenerationContext;
  updateGenerationContext: (partial: Partial<GenerationContext>) => void;
  
  // Uploaded images
  uploadedImages: UploadedImage[];
  addUploadedImage: (image: UploadedImage) => void;
  removeUploadedImage: (id: string) => void;
  
  // Tasks (New)
  tasks: GenerationTask[];
  addTask: (task: GenerationTask) => void;
  updateTaskStatus: (id: string, status: GenerationTask['status'], result?: any) => void;
  
  // Selected case
  selectedCase: string | null;
  setSelectedCase: (caseId: string | null) => void;
  
  // Credits
  credits: number;
  deductCredits: (amount: number) => boolean;

  smartLayoutFocusMode: boolean;
  setSmartLayoutFocusMode: (enabled: boolean) => void;

  smartLayoutAssets: SmartLayoutAsset[];
  addSmartLayoutAsset: (asset: { name: string; dataUrl: string }) => string;
  removeSmartLayoutAsset: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Tab
      activeTab: 'detail',
      setActiveTab: (tab) => set({ activeTab: tab }),

      domesticMode: 'single',
      setDomesticMode: (mode) => set({ domesticMode: mode }),
      
      // Input
      inputValue: '',
      setInputValue: (value) => set({ inputValue: value }),
      
      // Tags
      activeTags: ['detail', 'amazon', 'english'],
      toggleTag: (tagId) => set((state) => ({
        activeTags: state.activeTags.includes(tagId)
          ? state.activeTags.filter((id) => id !== tagId)
          : [...state.activeTags, tagId],
      })),

      generationContext: {
        platformId: 'amazon',
        language: 'en',
        model: '泰豪生图1.0',
        imageCount: 6,
        ratioMode: '智能比例',
        stylePreset: undefined,
        scene: 'detail',
      },
      updateGenerationContext: (partial) => set((state) => ({
        generationContext: { ...state.generationContext, ...partial },
      })),
      
      // Uploaded images
      uploadedImages: [],
      addUploadedImage: (image) => set((state) => ({
        uploadedImages: [...state.uploadedImages, image],
      })),
      removeUploadedImage: (id) => set((state) => ({
        uploadedImages: state.uploadedImages.filter((img) => img.id !== id),
      })),
      
      // Tasks
      tasks: [],
      addTask: (task) => set((state) => {
        const newTasks = [task, ...state.tasks];
        // Cleanup: keep max 50
        if (newTasks.length > 50) {
          // Keep first 50
          return { tasks: newTasks.slice(0, 50) };
        }
        return { tasks: newTasks };
      }),
      updateTaskStatus: (id, status, result) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          const updates: Partial<GenerationTask> = { status };
          if (status === 'success' && result) {
            updates.result = result;
          } else if (status === 'failed' && typeof result === 'string') {
            updates.error = result;
          }
          return { ...t, ...updates };
        }),
      })),
      
      // Selected case
      selectedCase: null,
      setSelectedCase: (caseId) => set({ selectedCase: caseId }),
      
      // Credits
      credits: 9310,
      deductCredits: (amount) => {
        const { credits } = get();
        if (credits >= amount) {
          set({ credits: credits - amount });
          return true;
        }
        // Trigger global event for insufficient credits
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('credit-insufficient'));
        }
        return false;
      },

      smartLayoutFocusMode: false,
      setSmartLayoutFocusMode: (enabled) => set({ smartLayoutFocusMode: enabled }),

      smartLayoutAssets: [],
      addSmartLayoutAsset: ({ name, dataUrl }) => {
        const id = hashStringFNV1a(dataUrl);
        const createdAt = Date.now();
        set((state) => {
          const exists = state.smartLayoutAssets.some((a) => a.id === id);
          const next = exists
            ? state.smartLayoutAssets.map((a) => (a.id === id ? { ...a, name: a.name || name } : a))
            : [{ id, name, dataUrl, createdAt }, ...state.smartLayoutAssets].slice(0, 30);
          return { smartLayoutAssets: next };
        });
        return id;
      },
      removeSmartLayoutAsset: (id) => set((state) => ({
        smartLayoutAssets: state.smartLayoutAssets.filter((a) => a.id !== id),
      })),
    }),
    {
      name: 'app-storage',
      version: 3,
      migrate: (persistedState: any) => {
        const state = persistedState ?? {};
        const model = state?.generationContext?.model;
        if (
          !model ||
          model === 'Seedream 4.5' ||
          model === 'doubao-seedream-4.5' ||
          model === '泰豪生图1.0' ||
          model === 'doubao-seedream-4-5-251128'
        ) {
          state.generationContext = { ...(state.generationContext ?? {}), model: '泰豪生图1.0' };
        }
        return state;
      },
      partialize: (state) => ({
        credits: state.credits,
        tasks: state.tasks,
        activeTags: state.activeTags,
        uploadedImages: state.uploadedImages,
        domesticMode: state.domesticMode,
        generationContext: state.generationContext,
        smartLayoutFocusMode: state.smartLayoutFocusMode,
        smartLayoutAssets: state.smartLayoutAssets,
      }),
    }
  )
);
