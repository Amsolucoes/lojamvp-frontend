import { useState } from 'react';
import { contemTexto } from './texto';

export const BANCOS = [
  { id: 'itau', nome: 'Itaú', cor: '#EC7000', sigla: 'Itaú' },
  { id: 'nubank', nome: 'Nubank', cor: '#8A05BE', sigla: 'Nu' },
  { id: 'santander', nome: 'Santander', cor: '#EC0000', sigla: 'S' },
  { id: 'bradesco', nome: 'Bradesco', cor: '#CC092F', sigla: 'B' },
  { id: 'caixa', nome: 'Caixa Econômica', cor: '#0070AD', sigla: 'CEF' },
  { id: 'bb', nome: 'Banco do Brasil', cor: '#FCE300', sigla: 'BB' },
  { id: 'inter', nome: 'Banco Inter', cor: '#FF7A00', sigla: 'Inter' },
  { id: 'c6', nome: 'C6 Bank', cor: '#1B1B1B', sigla: 'C6' },
  { id: 'mercadopago', nome: 'Mercado Pago', cor: '#00bcff', sigla: 'Me' },
  { id: 'picpay', nome: 'PicPay', cor: '#11c76f', sigla: 'Pi' },
  { id: 'pagbank', nome: 'PagBank', cor: '#1bb99a', sigla: 'Pa' },
  { id: 'sicredi', nome: 'Sicredi', cor: '#3fa110', sigla: 'Si' },
  { id: 'sicoob', nome: 'Sicoob', cor: '#003641', sigla: 'Si' },
  { id: 'btgpactual', nome: 'BTG Pactual', cor: '#001e61', sigla: 'BT' },
  { id: 'xp', nome: 'XP', cor: '#000000', sigla: 'XP' },
  { id: 'safra', nome: 'Banco Safra', cor: '#00003c', sigla: 'Ba' },
  { id: 'banrisul', nome: 'Banrisul', cor: '#010050', sigla: 'Ba' },
  { id: 'bv', nome: 'Banco BV', cor: '#5776d0', sigla: 'Ba' },
  { id: 'pan', nome: 'Banco Pan', cor: '#363636', sigla: 'Ba' },
  { id: 'neon', nome: 'Neon', cor: '#00a8ef', sigla: 'Ne' },
  { id: 'next', nome: 'Next', cor: '#1e3c3c', sigla: 'Ne' },
  { id: 'original', nome: 'Banco Original', cor: '#18ad47', sigla: 'Ba' },
  { id: 'agibank', nome: 'Agibank', cor: '#266bff', sigla: 'Ag' },
  { id: 'bmg', nome: 'Banco BMG', cor: '#f26321', sigla: 'Ba' },
  { id: 'digio', nome: 'Digio', cor: '#23292e', sigla: 'Di' },
  { id: 'willbank', nome: 'Will Bank', cor: '#ffd900', sigla: 'Wi' },
  { id: 'ton', nome: 'Ton', cor: '#0dea4a', sigla: 'To' },
  { id: 'stone', nome: 'Stone', cor: '#0db14b', sigla: 'St' },
  { id: 'infinitepay', nome: 'InfinitePay', cor: '#171527', sigla: 'In' },
  { id: 'nomad', nome: 'Nomad', cor: '#ffce04', sigla: 'No' },
  { id: 'revolut', nome: 'Revolut', cor: '#000000', sigla: 'Re' },
  { id: 'wise', nome: 'Wise', cor: '#9fe870', sigla: 'Wi' },
  { id: 'cora', nome: 'Cora', cor: '#fe3e6d', sigla: 'Co' },
  { id: 'asaas', nome: 'Asaas', cor: '#0038e5', sigla: 'As' },
  { id: 'bancodonordeste', nome: 'Banco do Nordeste', cor: '#a6193c', sigla: 'Ba' },
  { id: 'bancodaamazonia', nome: 'Banco da Amazônia', cor: '#003c2d', sigla: 'Ba' },
  { id: 'brb', nome: 'BRB — Banco de Brasília', cor: '#173e7d', sigla: 'BR' },
  { id: 'unicred', nome: 'Unicred', cor: '#004a35', sigla: 'Un' },
  { id: 'cresol', nome: 'Cresol', cor: '#ef8124', sigla: 'Cr' },
  { id: 'rico', nome: 'Rico', cor: '#010042', sigla: 'Ri' },
  { id: 'warren', nome: 'Warren Investimentos', cor: '#e24324', sigla: 'Wa' },
  { id: 'toro', nome: 'Toro Investimentos', cor: '#000000', sigla: 'To' },
  { id: 'bs2', nome: 'Banco BS2', cor: '#3333cc', sigla: 'Ba' },
  { id: 'daycoval', nome: 'Banco Daycoval', cor: '#001c55', sigla: 'Ba' },
  { id: 'sofisa', nome: 'Banco Sofisa', cor: '#17b497', sigla: 'Ba' },
  { id: 'ailos', nome: 'Ailos', cor: '#ffffff', sigla: 'Ai' },
  { id: 'paypal', nome: 'PayPal', cor: '#003087', sigla: 'Pa' },
  { id: 'ngcash', nome: 'NG.CASH', cor: '#000000', sigla: 'NG' },
  { id: 'recargapay', nome: 'RecargaPay', cor: '#053e6e', sigla: 'Re' },
  { id: 'efibank', nome: 'Efí Bank', cor: '#f37124', sigla: 'Ef' },
  { id: 'outro', nome: 'Outro / não informar', cor: 'var(--text-3)', sigla: '🏦' },
];

// Logos reais em /public/bancos (pacote react-bancos, MIT). As marcas pertencem às instituições.
const LOGO_BANCO = new Set(BANCOS.filter(b => b.id !== 'outro').map(b => b.id));

export function BankBadge({ bancoId, tamanho = 22 }: { bancoId?: string | null; tamanho?: number }) {
  const b = BANCOS.find(x => x.id === bancoId);
  if (!b || bancoId === 'outro' || !bancoId) return null;
  if (LOGO_BANCO.has(b.id)) {
    return (
      <img src={`/bancos/${b.id}.svg`} alt={b.nome} title={b.nome} width={tamanho} height={tamanho}
        style={{ borderRadius: tamanho * 0.22, flexShrink: 0, display: 'block' }} />
    );
  }
  return (
    <span title={b.nome} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tamanho, height: tamanho, borderRadius: '50%', background: b.cor,
      color: '#fff', fontSize: tamanho * 0.36, fontWeight: 700, flexShrink: 0,
    }}>
      {b.sigla.length > 3 ? b.sigla.slice(0, 2) : b.sigla}
    </span>
  );
}


// Lista de bancos com busca, usada ao criar/editar uma conta
export function SeletorBanco({ valor, onChange, altura = 200, rotuloNenhum = 'Nenhum / não informar' }: {
  valor: string; onChange: (id: string) => void; altura?: number; rotuloNenhum?: string;
}) {
  const [busca, setBusca] = useState('');
  const lista = BANCOS.filter(b => !busca.trim() || contemTexto(b.nome, busca));
  const item = (ativo: boolean, primeiro = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px',
    background: ativo ? 'var(--accent-bg)' : 'transparent', border: 'none',
    borderTop: primeiro ? 'none' : '1px solid var(--border)', textAlign: 'left', fontSize: 13,
    color: 'var(--text-1)', cursor: 'pointer',
  });
  return (
    <div>
      <input className="form-input" value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar banco…" style={{ marginBottom: 6 }} />
      <div style={{ maxHeight: altura, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {!busca.trim() && (
          <button type="button" onClick={() => onChange('')} style={item(valor === '', true)}>{rotuloNenhum}</button>
        )}
        {lista.map((b, i) => (
          <button key={b.id} type="button" onClick={() => onChange(b.id)} style={item(valor === b.id, !busca.trim() ? false : i === 0)}>
            <BankBadge bancoId={b.id} tamanho={20} />
            {b.nome}
          </button>
        ))}
        {lista.length === 0 && <div style={{ padding: 10, fontSize: 12, color: 'var(--text-3)' }}>Nenhum banco encontrado.</div>}
      </div>
    </div>
  );
}
