import { motion } from 'framer-motion';
import { Plus, Sparkles, Send, X, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createEditor, Editor, Element as SlateElement, Text, Transforms } from 'slate';
import type { Descendant, Node as SlateNode } from 'slate';
import { Editable, ReactEditor, Slate, useFocused, useSelected, useSlateStatic, withReact } from 'slate-react';
import type { RenderElementProps } from 'slate-react';
import { withHistory } from 'slate-history';
import type { HistoryEditor } from 'slate-history';
import { useAppStore } from '@/store/appStore';
import type { GenerationTask } from '@/store/appStore';
import { generateImage, parseTemplateVariablesFromImage } from '@/lib/api';
import {
  computeGroupGeneration,
  hasGeminiApiKeyConfigured,
  isTaihaoGeminiModel,
  resolveModelId,
  resolveSizeFromRatioMode,
} from '@/lib/generationContext';
import { useImageUploadPicker } from '@/hooks/useImageUploadPicker';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const TEMPLATE_VARIABLE_ELEMENT = 'template-variable';

type TemplateEditor = Editor & ReactEditor & HistoryEditor;

type VariableTemplatePreset = 'bow-detail' | 'hair-organizer';

type TemplateVariableKey =
  | 'productSubject'
  | 'productName'
  | 'styleTone'
  | 'lightingStyle'
  | 'colorPalette'
  | 'topBlockStyle'
  | 'headlineText'
  | 'sceneSetting'
  | 'rightScene'
  | 'detailOne'
  | 'detailTwo'
  | 'detailThree'
  | 'copyOne'
  | 'copyTwo'
  | 'copyThree'
  | 'fontStyle'
  | 'fontColor'
  | 'designMood'
  | 'outputRequirement';

type TemplateVariableElementNode = SlateElement & {
  type: typeof TEMPLATE_VARIABLE_ELEMENT;
  key: TemplateVariableKey;
  label: string;
  value: string;
  defaultValue: string;
  placeholder: string;
  children: { text: string }[];
};

type TemplateVariableDef = {
  key: TemplateVariableKey;
  label: string;
  defaultValue: string;
  placeholder: string;
};

const BOW_TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  { key: 'productSubject', label: '海报主题词', defaultValue: '蝴蝶结', placeholder: '请输入海报主题词' },
  { key: 'productName', label: '产品描述', defaultValue: '粉蓝配色蝴蝶结挂旗', placeholder: '请输入产品描述' },
  { key: 'styleTone', label: '整体风格', defaultValue: '清新轻奢、少女感但不幼稚', placeholder: '请输入整体风格' },
  { key: 'lightingStyle', label: '摄影光线', defaultValue: '柔和漫射日光', placeholder: '请输入摄影光线' },
  { key: 'colorPalette', label: '色彩方案', defaultValue: '马卡龙蓝、樱花粉、纯白，保持高级和谐', placeholder: '请输入色彩方案' },
  { key: 'topBlockStyle', label: '顶部版式', defaultValue: '浅蓝几何/波浪区块并保留留白', placeholder: '请输入顶部版式' },
  { key: 'headlineText', label: '标题文案', defaultValue: 'PRODUCT DETAILS', placeholder: '请输入标题文案' },
  { key: 'sceneSetting', label: '中部场景', defaultValue: '白色法式壁炉场景，粉蓝蝴蝶结弧线挂旗', placeholder: '请输入中部场景' },
  { key: 'detailOne', label: '细节1', defaultValue: '背面结构', placeholder: '请输入细节1' },
  { key: 'detailTwo', label: '细节2', defaultValue: '燕尾尾部设计', placeholder: '请输入细节2' },
  { key: 'detailThree', label: '细节3', defaultValue: '丝缎光泽（手持展示）', placeholder: '请输入细节3' },
  { key: 'copyOne', label: '英文点位1', defaultValue: 'Back View', placeholder: '请输入英文点位1' },
  { key: 'copyTwo', label: '英文点位2', defaultValue: 'Swallowtail-tail Design', placeholder: '请输入英文点位2' },
  { key: 'copyThree', label: '英文点位3', defaultValue: 'Soft Silky Luster', placeholder: '请输入英文点位3' },
  { key: 'fontStyle', label: '字体建议', defaultValue: '现代衬线或优雅斜体衬线', placeholder: '请输入字体建议' },
  { key: 'fontColor', label: '文字颜色', defaultValue: '深灰蓝', placeholder: '请输入文字颜色' },
  { key: 'designMood', label: '质感方向', defaultValue: '精品电商海报', placeholder: '请输入质感方向' },
  {
    key: 'outputRequirement',
    label: '输出要求',
    defaultValue: '商业级清晰度，丝缎高光细腻、褶皱自然、边缘整齐，禁止logo水印与随机文字',
    placeholder: '请输入输出要求',
  },
];

const HAIR_ORGANIZER_TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  { key: 'productName', label: '产品描述', defaultValue: '女孩发饰置物架（墙挂式发夹发带收纳架）', placeholder: '请输入产品描述' },
  { key: 'styleTone', label: '整体风格', defaultValue: '北欧奶油风、温暖亲子生活方式', placeholder: '请输入整体风格' },
  { key: 'lightingStyle', label: '摄影光线', defaultValue: '自然柔光摄影', placeholder: '请输入摄影光线' },
  { key: 'colorPalette', label: '色彩方案', defaultValue: '奶油白、浅木色、马卡龙粉彩发饰点缀', placeholder: '请输入色彩方案' },
  { key: 'topBlockStyle', label: '左侧信息区', defaultValue: '留出大面积留白用于品牌与标题文案', placeholder: '请输入信息区样式' },
  { key: 'headlineText', label: '标题文案', defaultValue: 'Hair Accessory Organizer for Girls', placeholder: '请输入标题文案' },
  { key: 'sceneSetting', label: '中部场景', defaultValue: '墙面挂置发饰收纳架，分层陈列发夹与发带', placeholder: '请输入中部场景' },
  { key: 'rightScene', label: '右侧场景', defaultValue: '儿童房柜体与小女孩场景，强化产品使用人群与家居适配氛围', placeholder: '请输入右侧场景' },
  { key: 'detailOne', label: '细节1', defaultValue: '分层收纳结构', placeholder: '请输入细节1' },
  { key: 'detailTwo', label: '细节2', defaultValue: '夹子与发带整齐陈列', placeholder: '请输入细节2' },
  { key: 'detailThree', label: '细节3', defaultValue: '儿童房家居融合感', placeholder: '请输入细节3' },
  { key: 'copyOne', label: '英文点位1', defaultValue: 'Multi-layer Storage', placeholder: '请输入英文点位1' },
  { key: 'copyTwo', label: '英文点位2', defaultValue: 'Neat & Easy Access', placeholder: '请输入英文点位2' },
  { key: 'copyThree', label: '英文点位3', defaultValue: 'Kid Room Friendly', placeholder: '请输入英文点位3' },
  { key: 'fontStyle', label: '字体建议', defaultValue: '圆润无衬线', placeholder: '请输入字体建议' },
  { key: 'fontColor', label: '文字颜色', defaultValue: '深暖灰', placeholder: '请输入文字颜色' },
  { key: 'designMood', label: '质感方向', defaultValue: '母婴精品海报', placeholder: '请输入质感方向' },
  {
    key: 'outputRequirement',
    label: '输出要求',
    defaultValue: '商业级清晰度，材质与光影真实自然，布料细节清晰，禁止logo水印与随机文字',
    placeholder: '请输入输出要求',
  },
];

const VARIABLE_DEFS_BY_PRESET: Record<VariableTemplatePreset, TemplateVariableDef[]> = {
  'bow-detail': BOW_TEMPLATE_VARIABLES,
  'hair-organizer': HAIR_ORGANIZER_TEMPLATE_VARIABLES,
};

function createVariableMap(preset: VariableTemplatePreset): Record<TemplateVariableKey, TemplateVariableDef> {
  return VARIABLE_DEFS_BY_PRESET[preset].reduce(
    (acc, item) => {
      acc[item.key] = item;
      return acc;
    },
    {} as Record<TemplateVariableKey, TemplateVariableDef>
  );
}

function isVariableTemplatePreset(preset: 'none' | 'bow-detail' | 'hair-organizer'): preset is VariableTemplatePreset {
  return preset === 'bow-detail' || preset === 'hair-organizer';
}

function isTemplateVariableElement(element: SlateElement): element is TemplateVariableElementNode {
  return (element as { type?: string }).type === TEMPLATE_VARIABLE_ELEMENT;
}

function withTemplateVariables(editor: TemplateEditor): TemplateEditor {
  const { isInline, isVoid } = editor;
  editor.isInline = (element) =>
    SlateElement.isElement(element) && (element as { type?: string }).type === TEMPLATE_VARIABLE_ELEMENT ? true : isInline(element);
  editor.isVoid = (element) =>
    SlateElement.isElement(element) && (element as { type?: string }).type === TEMPLATE_VARIABLE_ELEMENT ? true : isVoid(element);
  return editor;
}

function createVariableNode(key: TemplateVariableKey, variableMap: Record<TemplateVariableKey, TemplateVariableDef>): TemplateVariableElementNode {
  const item = variableMap[key];
  return {
    type: TEMPLATE_VARIABLE_ELEMENT,
    key: item.key,
    label: item.label,
    value: item.defaultValue,
    defaultValue: item.defaultValue,
    placeholder: item.placeholder,
    children: [{ text: '' }],
  };
}

function createParagraph(
  parts: Array<string | { key: TemplateVariableKey }>,
  variableMap: Record<TemplateVariableKey, TemplateVariableDef>
): Descendant {
  return {
    type: 'paragraph',
    children: parts.map((part) =>
      typeof part === 'string'
        ? { text: part }
        : (createVariableNode(part.key, variableMap) as unknown as Descendant)
    ),
  } as Descendant;
}

function createBowTemplateDocument(variableMap: Record<TemplateVariableKey, TemplateVariableDef>): Descendant[] {
  return [
    createParagraph(['生成一张', { key: 'productSubject' }, '商品详情海报，竖版 3:4，产品为', { key: 'productName' }, '。'], variableMap),
    createParagraph(['整体风格：', { key: 'styleTone' }, '，画面干净明亮。'], variableMap),
    createParagraph(['色彩方案：', { key: 'colorPalette' }, '。'], variableMap),
    createParagraph(['构图与版式：'], variableMap),
    createParagraph(['1）顶部使用', { key: 'topBlockStyle' }, '并放置标题“', { key: 'headlineText' }, '”；'], variableMap),
    createParagraph(['2）中部以', { key: 'sceneSetting' }, '为主场景，展示真实悬挂效果；'], variableMap),
    createParagraph([
      '3）底部放置三个圆形细节特写，分别体现',
      { key: 'detailOne' },
      '、',
      { key: 'detailTwo' },
      '、',
      { key: 'detailThree' },
      '。',
    ], variableMap),
    createParagraph(['文字建议：', { key: 'copyOne' }, ' / ', { key: 'copyTwo' }, ' / ', { key: 'copyThree' }, '。'], variableMap),
    createParagraph([
      '字体建议：',
      { key: 'fontStyle' },
      '，颜色使用',
      { key: 'fontColor' },
      '，整体质感偏',
      { key: 'designMood' },
      '。',
    ], variableMap),
    createParagraph(['输出要求：', { key: 'lightingStyle' }, '，', { key: 'outputRequirement' }, '。'], variableMap),
  ];
}

function createHairOrganizerTemplateDocument(variableMap: Record<TemplateVariableKey, TemplateVariableDef>): Descendant[] {
  return [
    createParagraph(['生成一张高转化电商商品详情图，产品为', { key: 'productName' }, '。'], variableMap),
    createParagraph(['整体风格：', { key: 'styleTone' }, '，画面干净通透。'], variableMap),
    createParagraph(['色彩方案：', { key: 'colorPalette' }, '。'], variableMap),
    createParagraph(['构图与版式：'], variableMap),
    createParagraph(['1）左侧信息区：', { key: 'topBlockStyle' }, '，标题建议“', { key: 'headlineText' }, '”；'], variableMap),
    createParagraph(['2）中部展示', { key: 'sceneSetting' }, '；'], variableMap),
    createParagraph(['3）右侧展示', { key: 'rightScene' }, '。'], variableMap),
    createParagraph([
      '4）重点突出',
      { key: 'detailOne' },
      '、',
      { key: 'detailTwo' },
      '、',
      { key: 'detailThree' },
      '。',
    ], variableMap),
    createParagraph(['文案建议：', { key: 'copyOne' }, ' / ', { key: 'copyTwo' }, ' / ', { key: 'copyThree' }, '。'], variableMap),
    createParagraph([
      '字体建议：',
      { key: 'fontStyle' },
      '，颜色使用',
      { key: 'fontColor' },
      '，整体质感偏',
      { key: 'designMood' },
      '。',
    ], variableMap),
    createParagraph(['输出要求：', { key: 'lightingStyle' }, '，', { key: 'outputRequirement' }, '。'], variableMap),
  ];
}

function createTemplateDocument(preset: VariableTemplatePreset): Descendant[] {
  const variableMap = createVariableMap(preset);
  if (preset === 'hair-organizer') return createHairOrganizerTemplateDocument(variableMap);
  return createBowTemplateDocument(variableMap);
}

function TemplateVariableChip({
  attributes,
  children,
  element,
}: RenderElementProps & { element: TemplateVariableElementNode }) {
  const editor = useSlateStatic() as TemplateEditor;
  const selected = useSelected();
  const focused = useFocused();
  const value = element.value ?? '';
  const [compositionValue, setCompositionValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const fallback = element.defaultValue ?? '';
  const displayValue = isComposing ? compositionValue : value;
  const source = displayValue || fallback || element.label;

  const commitValue = useCallback(
    (nextValue: string) => {
      if (nextValue === value) return;
      try {
        const at = ReactEditor.findPath(editor, element);
        Transforms.setNodes(editor, { value: nextValue } as Partial<TemplateVariableElementNode>, { at });
      } catch {
        // Node may be stale during rapid updates; ignore this frame.
      }
    },
    [editor, element, value]
  );

  const displayUnits = Array.from(source).reduce((sum, ch) => {
    // CJK and full-width chars occupy more visual space than latin chars.
    return sum + (/[\u1100-\u11FF\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFF60]/.test(ch) ? 2 : 1);
  }, 0);
  // Keep width tight to content while reserving a tiny buffer for caret/border.
  const width = Math.max(8, Math.min(42, displayUnits + 1));

  return (
    <span
      {...attributes}
      contentEditable={false}
      className="inline-flex items-center align-baseline mx-0.5"
    >
      {children}
      <Input
        value={displayValue}
        onChange={(e) => {
          const nextValue = e.target.value;
          if (isComposing) setCompositionValue(nextValue);
          if (!isComposing) commitValue(nextValue);
        }}
        onCompositionStart={(e) => {
          setCompositionValue(e.currentTarget.value);
          setIsComposing(true);
        }}
        onCompositionEnd={(e) => {
          setIsComposing(false);
          const nextValue = e.currentTarget.value;
          setCompositionValue('');
          commitValue(nextValue);
        }}
        onBlur={(e) => {
          const nextValue = e.currentTarget.value;
          if (isComposing) {
            setIsComposing(false);
            setCompositionValue('');
          }
          commitValue(nextValue);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (!(e.key === 'Enter' && (e.metaKey || e.ctrlKey))) e.stopPropagation();
        }}
        placeholder={element.placeholder}
        className={`h-6 px-2 py-0 text-xs text-violet-100 placeholder:text-violet-200/45 rounded-md bg-violet-500/15 border ${
          selected && focused ? 'border-violet-300/65' : 'border-violet-400/30'
        } focus-visible:ring-0 focus-visible:border-violet-300/70`}
        style={{ width: `${width}ch` }}
      />
    </span>
  );
}

export function InputArea() {
  const {
    inputValue,
    setInputValue,
    inputTemplatePreset,
    uploadedImages,
    removeUploadedImage,
    addTask,
    updateTaskStatus,
    tasks,
    generationContext,
  } = useAppStore();

  const [isFocused, setIsFocused] = useState(false);
  const [isTemplateAnalyzing, setIsTemplateAnalyzing] = useState(false);
  const analyzeRequestSeqRef = useRef(0);
  const [editor] = useState<TemplateEditor>(() =>
    withTemplateVariables(withReact(withHistory(createEditor())) as TemplateEditor)
  );
  const [templateInitialValue] = useState<Descendant[]>(() => createTemplateDocument('bow-detail'));

  const {
    fileInputRef,
    handleFileUpload,
    openPicker,
    isDragActive,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  } = useImageUploadPicker();

  const isGenerating = tasks.some((t) => t.status === 'processing');
  const usingVariableTemplate = isVariableTemplatePreset(inputTemplatePreset);

  const compileTemplatePrompt = useCallback((nodes: Descendant[]) => {
    const serializeNode = (node: SlateNode): string => {
      if (Text.isText(node)) return node.text;
      if (!SlateElement.isElement(node)) return '';
      const elementNode = node as SlateElement;
      if (isTemplateVariableElement(elementNode)) {
        return elementNode.value ?? '';
      }
      return elementNode.children.map((child) => serializeNode(child as SlateNode)).join('');
    };
    return nodes.map((node) => serializeNode(node as SlateNode)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }, []);

  useEffect(() => {
    if (!isVariableTemplatePreset(inputTemplatePreset)) return;
    const nextDoc = createTemplateDocument(inputTemplatePreset);
    Editor.withoutNormalizing(editor, () => {
      for (let i = editor.children.length - 1; i >= 0; i -= 1) {
        Transforms.removeNodes(editor, { at: [i] });
      }
      Transforms.insertNodes(editor, nextDoc, { at: [0] });
    });
    setInputValue(compileTemplatePrompt(nextDoc));
  }, [compileTemplatePrompt, editor, inputTemplatePreset, setInputValue]);

  const syncTemplatePromptToStore = useCallback(() => {
    if (!isVariableTemplatePreset(inputTemplatePreset)) return inputValue;
    const compiled = compileTemplatePrompt(editor.children as Descendant[]);
    if (compiled !== inputValue) setInputValue(compiled);
    return compiled;
  }, [compileTemplatePrompt, editor, inputTemplatePreset, inputValue, setInputValue]);

  const collectTemplateVariableValues = useCallback((nodes: Descendant[]) => {
    const values: Record<string, string> = {};
    const walk = (node: SlateNode) => {
      if (!SlateElement.isElement(node)) return;
      const elementNode = node as SlateElement;
      if (isTemplateVariableElement(elementNode)) {
        values[elementNode.key] = (elementNode.value ?? '').trim();
        return;
      }
      elementNode.children.forEach((child) => walk(child as SlateNode));
    };
    nodes.forEach((node) => walk(node as SlateNode));
    return values;
  }, []);

  const applyTemplateVariableValues = useCallback(
    (variables: Record<string, string>) => {
      let changed = 0;
      const entries = Array.from(
        Editor.nodes(editor, {
          at: [],
          match: (node) => SlateElement.isElement(node) && isTemplateVariableElement(node as SlateElement),
        })
      ) as Array<[SlateNode, number[]]>;

      if (entries.length === 0) return 0;

      Editor.withoutNormalizing(editor, () => {
        for (const [node, path] of entries) {
          const elementNode = node as TemplateVariableElementNode;
          const nextRaw = variables[elementNode.key];
          if (typeof nextRaw !== 'string') continue;
          const nextValue = nextRaw.trim();
          if (!nextValue || nextValue === elementNode.value) continue;
          Transforms.setNodes(editor, { value: nextValue } as Partial<TemplateVariableElementNode>, { at: path });
          changed += 1;
        }
      });

      return changed;
    },
    [editor]
  );

  const analyzeTemplateByImage = useCallback(async () => {
    if (!isVariableTemplatePreset(inputTemplatePreset)) return;
    if (!hasGeminiApiKeyConfigured()) return;
    const firstImage = uploadedImages[0]?.url;
    if (!firstImage) return;

    const seq = analyzeRequestSeqRef.current + 1;
    analyzeRequestSeqRef.current = seq;
    setIsTemplateAnalyzing(true);
    try {
      const currentVariables = collectTemplateVariableValues(editor.children as Descendant[]);
      const parsed = await parseTemplateVariablesFromImage({
        image: firstImage,
        preset: inputTemplatePreset,
        currentVariables,
      });
      if (seq !== analyzeRequestSeqRef.current) return;
      const changed = applyTemplateVariableValues(parsed.variables);
      if (changed > 0) {
        toast.success(`AI 识图已更新 ${changed} 个模板变量`);
      } else {
        toast.message('AI 识图完成，模板变量无需更新');
      }
    } catch (e: unknown) {
      if (seq !== analyzeRequestSeqRef.current) return;
      const message = e instanceof Error ? e.message : '';
      toast.message(message ? `AI 识图失败，沿用当前模板变量：${message}` : 'AI 识图失败，沿用当前模板变量');
    } finally {
      if (seq === analyzeRequestSeqRef.current) setIsTemplateAnalyzing(false);
    }
  }, [applyTemplateVariableValues, collectTemplateVariableValues, editor, inputTemplatePreset, uploadedImages]);

  const handleGenerate = async () => {
    const rawPrompt = usingVariableTemplate ? syncTemplatePromptToStore() : inputValue;

    if (!rawPrompt.trim() && uploadedImages.length === 0) {
      toast.error('请输入创作内容或上传产品图');
      return;
    }

    const modelId = resolveModelId(generationContext.model);
    if (isTaihaoGeminiModel(modelId) && !hasGeminiApiKeyConfigured()) {
      toast.error('未配置 VITE_GOOGLE_API_KEY，无法使用 泰豪生图模型');
      return;
    }
    const ratioModeRaw = (generationContext.ratioMode ?? '').trim();
    const ratioMode = ratioModeRaw === '智能比例' || ratioModeRaw.includes(':') ? ratioModeRaw : '智能比例';
    const qualityMode = generationContext.qualityMode === '4K' ? '4K' : '2K';
    const { size } = resolveSizeFromRatioMode({ ratioMode, qualityMode, modelId });
    const prompt = rawPrompt;

    const referenceCount = uploadedImages.length;
    const group = computeGroupGeneration({
      requestedCount: generationContext.imageCount,
      referenceCount,
      modelId,
    });

    if (generationContext.imageCount > 1 && group.sequential_image_generation !== 'auto') {
      toast.message('当前模型不支持组图，将按单图生成');
    }

    const newTask: GenerationTask = {
      id: Date.now().toString(),
      type: 'single',
      status: 'processing',
      createdAt: Date.now(),
      input: {
        prompt,
        referenceImages: uploadedImages.map((img) => img.url),
        model: modelId,
      },
    };

    addTask(newTask);

    try {
      const response = await generateImage({
        prompt,
        image:
          newTask.input.referenceImages.length > 0
            ? newTask.input.referenceImages.length === 1
              ? newTask.input.referenceImages[0]
              : newTask.input.referenceImages
            : undefined,
        model: modelId as any,
        size,
        sequential_image_generation: group.sequential_image_generation,
        sequential_image_generation_options:
          group.sequential_image_generation === 'auto' ? { max_images: group.maxImages } : undefined,
      });

      if (response.data && response.data.length > 0 && response.data[0].url) {
        updateTaskStatus(newTask.id, 'success', {
          images: response.data.map((d: any) => ({
            url: d.url,
            prompt,
          })),
        });
        toast.success('图片生成成功！');
        if (!usingVariableTemplate) {
          setInputValue('');
        }
      } else {
        const errorMsg = response.error?.message || response.message || '生成失败，请重试';
        updateTaskStatus(newTask.id, 'failed', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      updateTaskStatus(newTask.id, 'failed', '生成过程中出现错误');
      toast.error('生成过程中出现错误');
    }
  };

  const handleAnalyzeProduct = async () => {
    if (!usingVariableTemplate) {
      toast.message('请先选择变量模板，再执行 AI 识别商品');
      return;
    }
    if (uploadedImages.length === 0) {
      toast.error('请先上传产品图');
      return;
    }
    if (!hasGeminiApiKeyConfigured()) {
      toast.error('未配置 VITE_GOOGLE_API_KEY，无法执行模板识图');
      return;
    }
    if (isTemplateAnalyzing) return;
    await analyzeTemplateByImage();
  };

  const renderElement = useCallback((props: RenderElementProps) => {
    const element = props.element as SlateElement;
    if (isTemplateVariableElement(element)) {
      return <TemplateVariableChip {...props} element={element} />;
    }
    return (
      <p {...props.attributes} className="text-white/95 leading-6 text-base min-h-6">
        {props.children}
      </p>
    );
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-4"
    >
      {uploadedImages.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {uploadedImages.map((img) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20"
            >
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              <button
                onClick={() => removeUploadedImage(img.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`relative flex items-end gap-3 p-3 rounded-2xl bg-card/80 border transition-all duration-300 ${
          isFocused ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.15)]' : 'border-white/10'
        } ${isDragActive ? 'border-violet-400/70 bg-violet-500/10' : ''}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          multiple
          className="hidden"
        />

        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(139, 92, 246, 0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={openPicker}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-violet-600/10 border border-violet-500/30 text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">产品图</span>
        </motion.button>

        <div className="flex-1 min-w-0">
          {usingVariableTemplate ? (
            <div className="px-0 py-0">
              <Slate
                editor={editor}
                initialValue={templateInitialValue}
              >
                <Editable
                  renderElement={renderElement}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    setIsFocused(false);
                    syncTemplatePromptToStore();
                  }}
                  placeholder={inputTemplatePreset === 'hair-organizer' ? '编辑发饰置物架模板描述...' : '编辑蝴蝶结模板描述...'}
                  className="min-h-16 text-white placeholder:text-white/35"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleGenerate();
                    }
                  }}
                />
              </Slate>
            </div>
          ) : (
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="请输入产品名、卖点和场景；如：无线耳机，主动降噪，地铁上使用\n支持多行描述，按 Ctrl/Cmd + Enter 发送"
              className="min-h-14 max-h-40 bg-transparent border-0 shadow-none px-0 py-2 text-white placeholder:text-white/40 text-base leading-6 resize-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
            />
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void handleAnalyzeProduct()}
          disabled={isGenerating || isTemplateAnalyzing || !usingVariableTemplate || uploadedImages.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-violet-600/25 transition-shadow flex-shrink-0 disabled:opacity-50"
        >
          {isTemplateAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{isTemplateAnalyzing ? '识别中...' : 'AI 识别商品'}</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => void handleGenerate()}
          disabled={isGenerating || isTemplateAnalyzing}
          className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {isGenerating || isTemplateAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </motion.button>
      </div>
    </motion.div>
  );
}
