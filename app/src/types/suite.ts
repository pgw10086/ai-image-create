export interface SuiteTemplateItem {
  id: string;
  name: string;
  promptSuffix: string;
  referenceWeight?: number;
}

export interface SuiteTemplate {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  items?: SuiteTemplateItem[];
  availableShotIds?: string[];
  defaultShotIds?: string[];
}

export type SuiteItemStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface SuiteGeneratedImage {
  url: string;
  prompt: string;
}

export interface SuiteItemResult {
  id: string;
  shotId?: string;
  name: string;
  promptBase?: string;
  prompt: string;
  ratioMode?: string;
  sizeMode?: 'resolution' | 'pixels';
  sizeResolution?: '1K' | '2K' | '4K';
  sizePx?: string;
  size?: string;
  imageCount?: number;
  status: SuiteItemStatus;
  images?: SuiteGeneratedImage[];
  error?: string;
}

export interface SuiteGenerationResult {
  templateId: string;
  templateName: string;
  globalPrompt: string;
  model: string;
  watermark?: boolean;
  referenceImages: string[];
  useFirstImageAsReference: boolean;
  firstImageUrl?: string;
  items: SuiteItemResult[];
}

export interface SuiteShotDefinition {
  id: string;
  name: string;
  description?: string;
  defaultPromptSuffixZh: string;
  defaultRatioMode?: string;
  defaultImageCount?: number;
}

