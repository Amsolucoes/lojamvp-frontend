import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { ativarAvisos, assinaturaAtual, desativarAvisos, ehIos, enviarTeste, pushSuportado, rodandoComoApp } from '../utils/push';

// Card de Configurações: ativa/desativa os avisos de contas a pagar que vencem hoje (7h) neste aparelho.
export function AvisosPush() {
  const { sucesso, erro } = useToast();
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const suportado = pushSuportado();
  const ios = ehIos();
  const instalado = rodandoComoApp();
  // No iPhone o push só existe com o app adicionado à Tela de Início
  const precisaInstalar = ios && !instalado;

  useEffect(() => {
    if (!suportado) { setCarregando(false); return; }
    assinaturaAtual()
      .then(sub => setAtivo(!!sub && Notification.permission === 'granted'))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [suportado]);

  async function alternar() {
    setProcessando(true);
    try {
      if (ativo) {
        await desativarAvisos();
        setAtivo(false);
        sucesso('Avisos desativados neste aparelho.');
      } else {
        await ativarAvisos();
        setAtivo(true);
        sucesso('Avisos ativados! Você receberá os vencimentos do dia às 7h.');
      }
    } catch (e) {
      erro((e as Error).message);
    } finally {
      setProcessando(false);
    }
  }

  async function testar() {
    try {
      await enviarTeste();
      sucesso('Notificação de teste enviada.');
    } catch (e) {
      erro((e as Error).message);
    }
  }

  return (
    <div className="card" id="avisos-push">
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        {ativo ? <Bell size={16} /> : <BellOff size={16} />} Avisos no celular
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        Receba uma notificação todo dia às 7h com as contas a pagar que vencem no dia e ainda não foram pagas.
      </p>

      {!suportado ? (
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Este navegador não suporta notificações. {ios && 'No iPhone, use o Safari e adicione o app à Tela de Início.'}
        </p>
      ) : precisaInstalar ? (
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Para receber avisos no iPhone, primeiro instale o app:
          <ol style={{ margin: '8px 0 0 18px' }}>
            <li>Abra este site no <strong>Safari</strong>.</li>
            <li>Toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Abra o app pelo ícone novo e volte nesta tela para ativar os avisos.</li>
          </ol>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={ativo ? 'btn-secondary' : 'btn-primary'} disabled={carregando || processando} onClick={alternar}>
            {ativo ? 'Desativar avisos neste aparelho' : 'Ativar avisos neste aparelho'}
          </button>
          {ativo && <button className="btn-ghost" onClick={testar}>Enviar teste</button>}
          {!ios && !instalado && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Dica: use o menu do navegador → “Instalar app” / “Adicionar à tela inicial”.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
