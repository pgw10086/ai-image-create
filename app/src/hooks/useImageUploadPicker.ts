import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';

export function useImageUploadPicker() {
  const addUploadedImage = useAppStore((s) => s.addUploadedImage);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const processFiles = (files: FileList | File[] | null | undefined) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('请上传图片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) return;
        addUploadedImage({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
          url: event.target.result as string,
          name: file.name,
        });
        toast.success(`已上传: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    processFiles(e.dataTransfer?.files);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLElement>) => {
    const imageFiles = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);

    if (imageFiles.length === 0) return;

    e.preventDefault();
    processFiles(imageFiles);
  };

  const openPicker = () => fileInputRef.current?.click();

  return {
    fileInputRef,
    handleFileUpload,
    openPicker,
    isDragActive,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  };
}
