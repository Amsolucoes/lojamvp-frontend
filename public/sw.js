// Service worker do app: recebe os avisos push (contas que vencem hoje) mesmo com o app fechado.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { /* payload inválido */ }

  const titulo = dados.title || 'Aviso';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: '/logo-aldevsoftware-padrao.png',
      badge: '/logo-aldevsoftware-padrao.png',
      tag: dados.tag || 'aviso',
      renotify: true,
      data: { url: dados.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const janela of janelas) {
      if ('focus' in janela) {
        await janela.focus();
        if ('navigate' in janela) await janela.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
