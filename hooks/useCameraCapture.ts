'use client';
import { useRef, useCallback } from 'react';

export interface UseCameraCaptureOptions {
  maxWidth?:  number;
  maxHeight?: number;
  quality?:   number; // 0–1
  onCapture:  (dataUrl: string) => void;
}

export function useCameraCapture({
  maxWidth  = 800,
  maxHeight = 800,
  quality   = 0.75,
  onCapture,
}: UseCameraCaptureOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const compress = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width  = Math.round(width  * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = url;
      }),
    [maxWidth, maxHeight, quality],
  );

  const open = useCallback(() => {
    if (inputRef.current) inputRef.current.click();
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      try {
        const dataUrl = await compress(file);
        onCapture(dataUrl);
      } catch {
        // silently ignore
      }
    },
    [compress, onCapture],
  );

  return { inputRef, open, handleChange };
}
