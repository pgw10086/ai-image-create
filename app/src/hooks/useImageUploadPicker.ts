import { useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';

export function useImageUploadPicker() {
  const addUploadedImage = useAppStore((s) => s.addUploadedImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('请上传图片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) return;
        addUploadedImage({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: event.target.result as string,
          name: file.name,
        });
        toast.success(`已上传: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openPicker = () => fileInputRef.current?.click();

  return { fileInputRef, handleFileUpload, openPicker };
}

