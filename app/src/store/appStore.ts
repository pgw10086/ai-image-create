import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { SuiteGenerationResult } from '../types/suite';
import type { SmartLayoutAsset } from '@/types/smartLayout';
import { ensureAvailableModelLabel, getDefaultModelLabel } from '@/lib/generationContext';

const INTERRUPTED_TASK_ERROR = '页面刷新或关闭导致任务中断，请重新生成';

const IDB_DATABASE_NAME = 'ai-product-gen';
const IDB_STORE_NAME = 'zustand-persist';
const IDB_VERSION = 1;

type PersistRecord = {
  key: string;
  value: string;
  updatedAt: number;
};

let persistDbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function openPersistDb() {
  if (persistDbPromise) return persistDbPromise;

  persistDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = window.indexedDB.open(IDB_DATABASE_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });

  return persistDbPromise;
}

async function readIndexedDbValue(name: string) {
  const db = await openPersistDb();
  const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
  const store = transaction.objectStore(IDB_STORE_NAME);
  const record = await requestToPromise(store.get(name) as IDBRequest<PersistRecord | undefined>);
  await transactionDone(transaction);
  return record?.value ?? null;
}

async function writeIndexedDbValue(name: string, value: string) {
  const db = await openPersistDb();
  const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(IDB_STORE_NAME);
  store.put({ key: name, value, updatedAt: Date.now() } as PersistRecord);
  await transactionDone(transaction);
}

async function removeIndexedDbValue(name: string) {
  const db = await openPersistDb();
  const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(IDB_STORE_NAME);
  store.delete(name);
  await transactionDone(transaction);
}

const indexedDbStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window === 'undefined') return null;
    try {
      return await readIndexedDbValue(name);
    } catch (error) {
      console.warn('[store] 从 IndexedDB 读取缓存失败', error);
      return null;
    }
  },
  setItem: async (name, value) => {
    if (typeof window === 'undefined') return;
    try {
      await writeIndexedDbValue(name, value);
    } catch (error) {
      console.warn('[store] 写入 IndexedDB 失败，状态仅保留在当前会话', error);
    }
  },
  removeItem: async (name) => {
    if (typeof window === 'undefined') return;
    try {
      await removeIndexedDbValue(name);
    } catch (error) {
      console.warn('[store] 删除 IndexedDB 缓存失败', error);
    }
  },
};

function hashStringFNV1a(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeInterruptedSuiteResult(result?: SuiteGenerationResult) {
  if (!result?.items?.length) return result;

  let changed = false;
  const normalizedItems = result.items.map((item) => {
    if (item.status !== 'pending' && item.status !== 'processing') return item;
    changed = true;
    return {
      ...item,
      status: 'failed' as const,
      error: item.error || INTERRUPTED_TASK_ERROR,
    };
  });

  if (!changed) return result;
  return {
    ...result,
    items: normalizedItems,
  };
}

function normalizeInterruptedTask(task: GenerationTask): GenerationTask {
  const normalizedSuite = normalizeInterruptedSuiteResult(task.result?.suite);
  const hasSuiteChanged = normalizedSuite !== task.result?.suite;
  const isInterrupted = task.status === 'pending' || task.status === 'processing';

  if (!isInterrupted && !hasSuiteChanged) return task;

  const nextResult = hasSuiteChanged ? { ...(task.result ?? {}), suite: normalizedSuite } : task.result;
  if (isInterrupted) {
    return {
      ...task,
      status: 'failed',
      error: task.error || INTERRUPTED_TASK_ERROR,
      result: nextResult,
    };
  }

  return {
    ...task,
    result: nextResult,
  };
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
  qualityMode: '2K' | '4K';
  stylePreset?: string;
  scene?: string;
}

export interface SingleTemplateUiState {
  isApplied: boolean;
  previewImage: string | null;
  previewTitle: string;
  isInputCollapsed: boolean;
  appliedAt: number | null;
}

export interface AppState {
  // Active tab
  activeTab: 'detail' | 'single' | 'smart_layout';
  setActiveTab: (tab: 'detail' | 'single' | 'smart_layout') => void;
  
  domesticMode: 'single' | 'suite';
  setDomesticMode: (mode: 'single' | 'suite') => void;

  suitePresetRequest: { presetId: 'detail' | 'brand'; requestedAt: number } | null;
  requestSuitePreset: (presetId: 'detail' | 'brand') => void;

  // Input
  inputValue: string;
  setInputValue: (value: string) => void;
  inputTemplatePreset: 'none' | 'bow-detail' | 'hair-organizer';
  setInputTemplatePreset: (preset: 'none' | 'bow-detail' | 'hair-organizer') => void;
  singleTemplateUi: SingleTemplateUiState;
  applySingleTemplatePreview: (payload: { image: string; title: string }) => void;
  toggleSingleInputCollapsed: () => void;
  clearSingleTemplatePreview: () => void;
  
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
  smartLayoutFocusMode: boolean;
  setSmartLayoutFocusMode: (enabled: boolean) => void;

  smartLayoutAssets: SmartLayoutAsset[];
  addSmartLayoutAsset: (asset: { name: string; dataUrl: string }) => string;
  removeSmartLayoutAsset: (id: string) => void;
  clearSmartLayoutAssets: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Tab
      activeTab: 'detail',
      setActiveTab: (tab) => set({ activeTab: tab }),

      domesticMode: 'single',
      setDomesticMode: (mode) => set({ domesticMode: mode }),

      suitePresetRequest: null,
      requestSuitePreset: (presetId) => set({ suitePresetRequest: { presetId, requestedAt: Date.now() } }),
      
      // Input
      inputValue: '',
      setInputValue: (value) => set({ inputValue: value }),
      inputTemplatePreset: 'none',
      setInputTemplatePreset: (preset) => set({ inputTemplatePreset: preset }),
      singleTemplateUi: {
        isApplied: false,
        previewImage: null,
        previewTitle: '',
        isInputCollapsed: false,
        appliedAt: null,
      },
      applySingleTemplatePreview: ({ image, title }) =>
        set({
          singleTemplateUi: {
            isApplied: true,
            previewImage: image || null,
            previewTitle: title || '',
            isInputCollapsed: true,
            appliedAt: Date.now(),
          },
        }),
      toggleSingleInputCollapsed: () =>
        set((state) => ({
          singleTemplateUi: {
            ...state.singleTemplateUi,
            isInputCollapsed: !state.singleTemplateUi.isInputCollapsed,
          },
        })),
      clearSingleTemplatePreview: () =>
        set((state) => ({
          singleTemplateUi: {
            ...state.singleTemplateUi,
            isApplied: false,
            previewImage: null,
            previewTitle: '',
            isInputCollapsed: false,
            appliedAt: null,
          },
        })),
      
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
        model: getDefaultModelLabel(),
        imageCount: 6,
        ratioMode: '智能比例',
        qualityMode: '2K',
        stylePreset: undefined,
        scene: 'detail',
      },
      updateGenerationContext: (partial) => set((state) => ({
        generationContext: (() => {
          const prev = state.generationContext;
          const nextModel = ensureAvailableModelLabel(partial.model ?? prev.model);
          const rawRatioMode = (partial.ratioMode ?? prev.ratioMode ?? '').trim();
          const legacyQualityByRatio: '2K' | '4K' | null =
            rawRatioMode === '4K' ? '4K' : rawRatioMode === '1K' || rawRatioMode === '2K' ? '2K' : null;
          const normalizedRatioMode = rawRatioMode === '智能比例' || rawRatioMode.includes(':') ? rawRatioMode : '智能比例';
          const normalizedQualityMode =
            (partial.qualityMode ?? legacyQualityByRatio ?? prev.qualityMode) === '4K' ? '4K' : '2K';

          return {
            ...prev,
            ...partial,
            model: nextModel,
            ratioMode: normalizedRatioMode,
            qualityMode: normalizedQualityMode,
          };
        })(),
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
      clearSmartLayoutAssets: () => set({ smartLayoutAssets: [] }),
    }),
    {
      name: 'app-storage',
      version: 4,
      storage: createJSONStorage(() => indexedDbStorage),
      migrate: (persistedState: any) => {
        const state = persistedState ?? {};
        const current = state?.generationContext?.model;
        const safeModel = !current ? getDefaultModelLabel() : ensureAvailableModelLabel(current);
        state.generationContext = { ...(state.generationContext ?? {}), model: safeModel };
        return state;
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AppState>;
        const persistedTasks = Array.isArray(persisted.tasks) ? persisted.tasks : [];
        const mergedGenerationContext = {
          ...currentState.generationContext,
          ...(persisted.generationContext ?? {}),
        };

        return {
          ...currentState,
          ...persisted,
          generationContext: {
            ...mergedGenerationContext,
            model: ensureAvailableModelLabel(mergedGenerationContext.model),
          },
          tasks: persistedTasks.map(normalizeInterruptedTask),
        };
      },
      partialize: (state) => ({
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
