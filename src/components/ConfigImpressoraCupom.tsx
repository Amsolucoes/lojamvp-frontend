import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Venda } from '../types';
import { CupomNaoFiscal } from './CupomNaoFiscal';
import {
  ConfigCupom, LarguraCupom, MARGENS_PADRAO, lerConfigCupom, salvarConfigCupom, imprimirCupomNaoFiscal,
} from '../utils/cupomConfig';

const COMANDO_CHROME = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing https://app.aldevsoftware.com.br/caixa';

// Cupom de exemplo para o teste de impressão
const VENDA_TESTE = {
  id: 'teste',
  itens: [
    { produtoId: '1', nomeProduto: 'Camiseta Algodão Manga Longa (M / azul marinho)', quantidade: 2, precoUnitario: 129.9, subtotal: 259.8 },
    { produtoId: '2', nomeProduto: 'Bermuda', quantidade: 1, precoUnitario: 99.9, subtotal: 99.9 },
  ],
  total: 359.7, desconto: 10, totalFinal: 349.7,
  formaPagamento: 'credito', formasPagamento: JSON.stringify([{ forma: 'credito', valor: 349.7, parcelas: 3 }]),
  criadaEm: new Date().toISOString(), nomeCliente: 'Cliente de teste',
} as unknown as Venda;

export function ConfigImpressoraCupom() {
  const { nomeLoja } = useApp();
  const { sucesso } = useToast();
  const [cfg, setCfg] = useState<ConfigCupom>(() => lerConfigCupom());

  function atualizar(parcial: Partial<ConfigCupom>) {
    const novo = { ...cfg, ...parcial };
    setCfg(novo);
    salvarConfigCupom(novo);
  }

  function escolherLargura(l: LarguraCupom) {
    atualizar({ largura: l, ...MARGENS_PADRAO[l] });
  }

  function num(v: string, atual: number) {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? atual : Math.min(20, Math.max(0, n));
  }

  function copiarComando() {
    navigator.clipboard?.writeText(COMANDO_CHROME).then(() => sucesso('Comando copiado.')).catch(() => {});
  }

  return (
    <div className="card">
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Printer size={16} /> Impressora de cupom (não fiscal)
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Vale só para este computador, que é onde a impressora está ligada.
      </p>

      <div className="form-group">
        <label className="form-label">Largura do papel</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([58, 80] as const).map(l => (
            <button key={l} type="button" className={cfg.largura === l ? 'btn-primary' : 'btn-secondary'}
              style={{ minWidth: 90 }} onClick={() => escolherLargura(l)}>{l} mm</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          58 mm: impressoras pequenas e portáteis (a maioria das Bluetooth). 80 mm: impressoras de balcão.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Nome da impressora <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(opcional, só para você lembrar)</span></label>
        <input value={cfg.nomeImpressora} placeholder="Ex: POS-58"
          onChange={e => atualizar({ nomeImpressora: e.target.value })} />
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          O navegador não deixa o sistema ver as impressoras do computador. Quem escolhe a impressora é a janela de impressão do navegador.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Margens do cupom (mm)</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Esquerda</div>
            <input type="number" step={0.5} min={0} max={20} style={{ width: 90 }} value={cfg.margemEsq}
              onChange={e => atualizar({ margemEsq: num(e.target.value, cfg.margemEsq) })} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Direita</div>
            <input type="number" step={0.5} min={0} max={20} style={{ width: 90 }} value={cfg.margemDir}
              onChange={e => atualizar({ margemDir: num(e.target.value, cfg.margemDir) })} />
          </div>
          <button type="button" className="btn-secondary" onClick={() => atualizar({ ...MARGENS_PADRAO[cfg.largura] })}>
            Restaurar padrão
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          Se o valor ou o fim das linhas sair cortado à direita, aumente a margem direita. Se cortar à esquerda, aumente a esquerda.
        </p>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.6 }}>
        <strong>Na janela de impressão do navegador, confira:</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          <li><strong>Escala: Padrão (100)</strong>. O Chrome lembra a última escala usada; se estiver em 80, o cupom sai pequeno e deslocado.</li>
          <li>Margens: <strong>Nenhuma</strong>.</li>
          <li>Cabeçalhos e rodapés: <strong>desligados</strong>.</li>
          <li>Tamanho do papel: o de {cfg.largura} mm da sua impressora (ex.: ZPrinter Paper 58 x 3276 mm).</li>
        </ul>
      </div>

      <button type="button" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => imprimirCupomNaoFiscal(cfg.largura)}>
        <Printer size={14} /> Imprimir cupom de teste
      </button>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Imprimir direto, sem a janela de prévia</div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Um site não consegue pular a janela de impressão (é uma regra de segurança do navegador). O que funciona é abrir o
          Google Chrome com a opção <strong>--kiosk-printing</strong>, que imprime direto na impressora padrão do Windows:
        </p>
        <ol style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, paddingLeft: 18, margin: '6px 0' }}>
          <li>Deixe a impressora de cupom como <strong>impressora padrão</strong> do Windows.</li>
          <li>Crie um atalho do Chrome na área de trabalho e, em <em>Propriedades → Destino</em>, cole o comando abaixo.</li>
          <li>Use esse atalho só para o Caixa: nele, <strong>tudo</strong> o que for impresso sai direto na impressora padrão.</li>
        </ol>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ fontSize: 11, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', wordBreak: 'break-all', flex: '1 1 260px' }}>
            {COMANDO_CHROME}
          </code>
          <button type="button" className="btn-secondary" onClick={copiarComando}>Copiar comando</button>
        </div>
      </div>

      <CupomNaoFiscal venda={VENDA_TESTE} nomeLoja={nomeLoja || 'Minha Loja'}
        larguraMm={cfg.largura} margemEsqMm={cfg.margemEsq} margemDirMm={cfg.margemDir} />
    </div>
  );
}
