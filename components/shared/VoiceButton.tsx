'use client';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface Props {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceButton({ onResult, className = '' }: Props) {
  const { listening, supported, toggle } = useVoiceInput({ onResult });

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Parar gravação' : 'Falar (voz)'}
      className={`flex items-center justify-center rounded-full transition-all select-none ${
        listening
          ? 'bg-red-500 text-white shadow-lg animate-pulse w-10 h-10'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 w-9 h-9'
      } ${className}`}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
