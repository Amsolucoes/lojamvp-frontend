// Gera um relatório limpo da lista (contas a pagar / a receber) e abre a janela de impressão
// do navegador — onde o usuário escolhe "Salvar como PDF" ou a impressora.

export interface LinhaImpressao {
  descricao: string;
  categoria?: string | null;
  conta?: string | null;
  vencimento: string;
  valor: number;
  status: string; // pago | pendente
}

interface Opcoes {
  tipo: 'pagar' | 'receber';
  loja: string;
  periodo: string;
  filtros: string[];
  linhas: LinhaImpressao[];
}

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

function esc(t: string | null | undefined): string {
  return (t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function imprimirLista({ tipo, loja, periodo, filtros, linhas }: Opcoes) {
  const hoje0h = new Date(new Date().toDateString());
  const rotuloPago = tipo === 'pagar' ? 'Pago' : 'Recebido';
  const titulo = tipo === 'pagar' ? 'Contas a pagar' : 'Contas a receber';

  const situacao = (l: LinhaImpressao) =>
    l.status === 'pago' ? 'pago'
      : l.vencimento && new Date(l.vencimento) < hoje0h ? 'vencido' : 'pendente';

  let totalPago = 0, totalPendente = 0, totalVencido = 0;
  linhas.forEach(l => {
    const s = situacao(l);
    if (s === 'pago') totalPago += l.valor;
    else if (s === 'vencido') totalVencido += l.valor;
    else totalPendente += l.valor;
  });
  const total = totalPago + totalPendente + totalVencido;

  const rotuloSituacao: Record<string, string> = { pago: rotuloPago, pendente: 'Pendente', vencido: 'Vencido' };

  const corpo = linhas.map(l => {
    const s = situacao(l);
    return `<tr class="${s}">
      <td>${dataBr(l.vencimento)}</td>
      <td>${esc(l.descricao)}</td>
      <td>${esc(l.categoria) || '—'}</td>
      <td>${esc(l.conta) || '—'}</td>
      <td class="num">${moeda(l.valor)}</td>
      <td class="sit">${rotuloSituacao[s]}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${titulo} — ${esc(periodo)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1d29; font-size: 11px; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #565b70; margin-bottom: 4px; }
  .filtros { color: #565b70; font-size: 10px; margin-bottom: 10px; }
  .resumo { display: flex; gap: 10px; margin: 10px 0 14px; }
  .resumo div { flex: 1; border: 1px solid #d0d3de; border-radius: 6px; padding: 7px 9px; }
  .resumo span { display: block; font-size: 9px; text-transform: uppercase; color: #565b70; letter-spacing: .04em; }
  .resumo strong { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #565b70; border-bottom: 2px solid #1a1d29; padding: 5px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #e2e4ec; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .sit { white-space: nowrap; font-weight: 600; }
  tr.pago td { color: #6b7080; }
  tr.vencido .sit { color: #b91c1c; }
  tfoot td { border-top: 2px solid #1a1d29; border-bottom: 0; font-weight: 700; font-size: 12px; padding-top: 8px; }
  .rodape { margin-top: 12px; font-size: 9px; color: #8a8fa3; }
</style></head>
<body>
  <h1>${titulo}</h1>
  <div class="sub">${esc(loja)}${loja ? ' · ' : ''}${esc(periodo)}</div>
  ${filtros.length ? `<div class="filtros">Filtros: ${filtros.map(esc).join(' · ')}</div>` : ''}
  <div class="resumo">
    <div><span>Total</span><strong>${moeda(total)}</strong></div>
    <div><span>${rotuloPago}</span><strong>${moeda(totalPago)}</strong></div>
    <div><span>Pendente</span><strong>${moeda(totalPendente)}</strong></div>
    <div><span>Vencido</span><strong>${moeda(totalVencido)}</strong></div>
  </div>
  <table>
    <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="num">Valor</th><th>Situação</th></tr></thead>
    <tbody>${corpo}</tbody>
    <tfoot><tr><td colspan="4">${linhas.length} lançamento${linhas.length !== 1 ? 's' : ''}</td><td class="num">${moeda(total)}</td><td></td></tr></tfoot>
  </table>
  <div class="rodape">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

  // iframe oculto: evita bloqueio de pop-up e não mexe na tela atual
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) { iframe.remove(); return; }

  doc.open();
  doc.write(html);
  doc.close();

  const limpar = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', limpar);
  setTimeout(() => { win.focus(); win.print(); setTimeout(limpar, 60000); }, 250);
}
