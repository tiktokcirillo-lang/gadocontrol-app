'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'ios-install-banner-dismissed';

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === '1';

    if (isIOS && !isStandalone && !isDismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-3 flex items-start gap-3">
      <img src="/icons/icon-192.png" alt="GadoControl" className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Instale o GadoControl</p>
        <p className="text-xs text-gray-600 mt-0.5">
          Toque em{' '}
          <span className="inline-block align-middle" aria-label="botão compartilhar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" className="inline w-4 h-4 text-blue-500 fill-blue-500">
              <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z"/>
              <path d="M24 7h2v21h-2z"/>
              <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z"/>
            </svg>
          </span>{' '}
          e depois <strong>"Adicionar à Tela de Início"</strong> para instalar sem usar a loja de apps.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600"
        aria-label="Fechar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
