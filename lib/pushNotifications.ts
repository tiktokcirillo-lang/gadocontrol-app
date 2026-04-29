'use client';

// Solicita permissão e registra o service worker para push
export async function solicitarPermissao(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export function permissaoAtual(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

// Exibe uma notificação local (sem servidor push)
export async function notificarLocal(title: string, body: string, url?: string) {
  if (!('serviceWorker' in navigator)) return;
  const permission = await solicitarPermissao();
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'gadocontrol-local',
    data: url ? { url } : undefined,
  });
}

// Verifica alertas de saúde do rebanho e dispara notificações
export async function verificarAlertasSaude(db: import('@/lib/types').DB) {
  if (permissaoAtual() !== 'granted') return;

  const hoje = new Date();
  const animais = db.animais ?? [];
  const eventos = db.eventos ?? [];

  // Vacinas vencidas nos últimos 30 dias que precisam de reforço
  const VACINAS_ANUAIS: import('@/lib/types').EventoTipo[] = [
    'Vacina Febre Aftosa', 'Vacina Clostridioses', 'Vacina Brucelose', 'Vacina Raiva',
  ];

  const alertas: { title: string; body: string }[] = [];

  for (const vacina of VACINAS_ANUAIS) {
    const eventosVacina = eventos
      .filter(e => e.tipo === vacina)
      .sort((a, b) => b.data.localeCompare(a.data));

    if (eventosVacina.length > 0) {
      const ultimo = eventosVacina[0];
      const diasDesde = Math.floor((hoje.getTime() - new Date(ultimo.data).getTime()) / 86400000);
      if (diasDesde >= 330) { // ~11 meses = hora de revacinar
        alertas.push({
          title: `⚠️ Vacina — ${vacina}`,
          body: `Última aplicação há ${diasDesde} dias. Considere revacinar o rebanho.`,
        });
      }
    }
  }

  // Animais com previsão de parto hoje ou nos próximos 7 dias
  const previsoesParto = animais.filter(a => {
    if (!a.dataPrevistoParto) return false;
    const diff = Math.floor((new Date(a.dataPrevistoParto).getTime() - hoje.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  if (previsoesParto.length > 0) {
    alertas.push({
      title: '🐮 Partos Previstos',
      body: `${previsoesParto.length} animal(is) com parto nos próximos 7 dias.`,
    });
  }

  // Dispara até 2 alertas para não inundar o usuário
  for (const alerta of alertas.slice(0, 2)) {
    await notificarLocal(alerta.title, alerta.body, '/saude');
  }
}
