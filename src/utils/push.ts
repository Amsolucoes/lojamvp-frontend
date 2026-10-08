import { api } from '../services/api';

function base64UrlParaBytes(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64);
  return Uint8Array.from(bruto, c => c.charCodeAt(0));
}

function bytesParaBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let texto = '';
  bytes.forEach(b => { texto += String.fromCharCode(b); });
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pushSuportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iPhone/iPad só liberam notificações para apps adicionados à Tela de Início
export function ehIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function rodandoComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function assinaturaAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null;
  const reg = await registro();
  return reg.pushManager.getSubscription();
}

export async function ativarAvisos(): Promise<void> {
  if (!pushSuportado()) throw new Error('Este aparelho/navegador não suporta notificações.');

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão de notificação negada. Libere nas configurações do navegador.');

  const { chave } = await api.get<{ chave: string }>('/api/push/chave-publica');
  const reg = await registro();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(chave).buffer as ArrayBuffer,
    });
  }

  await api.post('/api/push/assinar', {
    endpoint: sub.endpoint,
    chavePublica: bytesParaBase64Url(sub.getKey('p256dh')),
    chaveAuth: bytesParaBase64Url(sub.getKey('auth')),
  });
}

export async function desativarAvisos(): Promise<void> {
  const sub = await assinaturaAtual();
  if (!sub) return;
  await api.post('/api/push/cancelar', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function enviarTeste(): Promise<void> {
  await api.post('/api/push/testar', {});
}
