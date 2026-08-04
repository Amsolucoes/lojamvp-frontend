import { Venda } from '../types';

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const NOMES_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
};

interface Props {
  venda: Venda | null;
  nomeLoja: string;
}

export function CupomNaoFiscal({ venda, nomeLoja }: Props) {
  if (!venda) return null;

  const dataHora = new Date(venda.criadaEm).toLocaleString('pt-BR');

  let formas: { forma: string; valor: number; parcelas?: number }[];
  try {
    formas = venda.formasPagamento ? JSON.parse(venda.formasPagamento as any) : [{ forma: venda.formaPagamento, valor: venda.totalFinal }];
  } catch {
    formas = [{ forma: venda.formaPagamento, valor: venda.totalFinal }];
  }

  return (
    <div className="cupom-impressao" id="area-impressao-cupom">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{nomeLoja}</div>
        <div style={{ fontSize: 10, marginTop: 2 }}>CUPOM NÃO FISCAL</div>
        <div style={{ fontSize: 9 }}>Não possui valor fiscal</div>
      </div>

      <div className="cupom-linha" />
      <div style={{ fontSize: 10 }}>{dataHora}</div>
      {venda.nomeCliente && <div style={{ fontSize: 10 }}>Cliente: {venda.nomeCliente}</div>}
      <div className="cupom-linha" />

      {venda.itens.map((item, idx) => (
        <div key={idx} style={{ fontSize: 11, marginBottom: 4 }}>
          <div>{item.nomeProduto}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{item.quantidade} x {fmt(item.precoUnitario)}</span>
            <span>{fmt(item.subtotal)}</span>
          </div>
        </div>
      ))}

      <div className="cupom-linha" />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>Subtotal</span><span>{fmt(venda.total)}</span>
      </div>
      {venda.desconto > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>Desconto</span><span>- {fmt(venda.desconto)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
        <span>TOTAL</span><span>{fmt(venda.totalFinal)}</span>
      </div>

      <div className="cupom-linha" />
      {formas.map((f, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>{NOMES_FORMA[f.forma] ?? f.forma}{f.parcelas && f.parcelas > 1 ? ` (${f.parcelas}x)` : ''}</span>
          <span>{fmt(f.valor)}</span>
        </div>
      ))}
      {(venda as any).troco > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span>Troco</span><span>{fmt((venda as any).troco)}</span>
        </div>
      )}

      <div className="cupom-linha" />
      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 8 }}>Obrigado pela preferência!</div>
    </div>
  );
}