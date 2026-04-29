'use client';
import { useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { uploadFoto, storageDisponivel } from '@/lib/storage';

interface Props {
  value?:    string; // base64 dataUrl ou URL pública do Storage
  onChange:  (v: string | undefined) => void;
  label?:    string;
  ownerUid?: string; // UID do dono — necessário para upload no Storage
}

export function PhotoCapture({ value, onChange, label = 'Foto', ownerUid }: Props) {
  const [uploading, setUploading] = useState(false);

  const { inputRef, open, handleChange } = useCameraCapture({
    maxWidth: 800, maxHeight: 800, quality: 0.75,
    onCapture: async (dataUrl) => {
      // Se Storage está disponível e temos o UID do dono, faz upload
      if (ownerUid && storageDisponivel()) {
        setUploading(true);
        try {
          const url = await uploadFoto(dataUrl, ownerUid);
          onChange(url);
        } catch {
          // Fallback: usa base64 se upload falhar
          onChange(dataUrl);
        } finally {
          setUploading(false);
        }
      } else {
        // Sem Storage — usa base64 local
        onChange(dataUrl);
      }
    },
  });

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      )}

      {value ? (
        <div className="relative w-full max-w-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Foto"
            className="w-full rounded-xl border object-cover aspect-square"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : uploading ? (
        <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Enviando foto...</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <Camera className="w-4 h-4" />
          <span>Tirar foto / Galeria</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
