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
  items: SuiteTemplateItem[];
}

export type SuiteItemStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface SuiteGeneratedImage {
  url: string;
  prompt: string;
}

export interface SuiteItemResult {
  id: string;
  name: string;
  prompt: string;
  status: SuiteItemStatus;
  images?: SuiteGeneratedImage[];
  error?: string;
}

export interface SuiteGenerationResult {
  templateId: string;
  templateName: string;
  globalPrompt: string;
  model: string;
  size?: string;
  referenceImages: string[];
  useFirstImageAsReference: boolean;
  firstImageUrl?: string;
  items: SuiteItemResult[];
}

