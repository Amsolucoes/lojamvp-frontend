// Configuração da impressora de cupom não fiscal. Fica neste computador (localStorage),
// porque a impressora é ligada em um computador específico.

export type LarguraCupom = 58 | 80;

export interface ConfigCupom {
  largura: LarguraCupom;
  margemEsq: number;        // mm
  margemDir: number;        // mm
  nomeImpressora: string;   // só para referência (o navegador não deixa o site ler as impressoras do Windows)
}

// Margens padrão. 58 mm: a área impressa dessas impressoras é ~48 mm e fica levemente deslocada,
// então a margem direita é maior para o último caractere do valor não ser cortado.
export const MARGENS_PADRAO: Record<LarguraCupom, { margemEsq: number; margemDir: number }> = {
  58: { margemEsq: 4.5, margemDir: 7 },
  80: { margemEsq: 4, margemDir: 4 },
};

const CHAVE = 'loja:cupom-config';
const CHAVE_ANTIGA = 'loja:cupom-largura';

export function lerConfigCupom(): ConfigCupom {
  let largura: LarguraCupom = 80;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      let c = JSON.parse(bruto) as Partial<ConfigCupom>;
      largura = c.largura === 58 ? 58 : 80;
      // Margens do 58 mm gravadas pelo padrão antigo (3,5 / 7) passam para o padrão novo
      if (largura === 58 && c.margemEsq === 3.5 && c.margemDir === 7) c = { ...c, margemEsq: undefined, margemDir: undefined };
      const num = (v: unknown, padrao: number) => (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 20 ? v : padrao);
      return {
        largura,
        margemEsq: num(c.margemEsq, MARGENS_PADRAO[largura].margemEsq),
        margemDir: num(c.margemDir, MARGENS_PADRAO[largura].margemDir),
        nomeImpressora: typeof c.nomeImpressora === 'string' ? c.nomeImpressora : '',
      };
    }
    // Migra a escolha antiga (só a largura)
    if (localStorage.getItem(CHAVE_ANTIGA) === '58') largura = 58;
  } catch { /* sem localStorage: usa o padrão */ }
  return { largura, ...MARGENS_PADRAO[largura], nomeImpressora: '' };
}

export function salvarConfigCupom(c: ConfigCupom) {
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* ignora */ }
}

// Imprime o cupom que estiver na tela (elemento .cupom-impressao). A janela de prévia é do navegador:
// um site não consegue pulá-la (só o Chrome com --kiosk-printing).
export function imprimirCupomNaoFiscal(larguraMm: number) {
  const estilo = document.createElement('style');
  estilo.textContent = `@page { size: ${larguraMm}mm auto; margin: 0; }`;
  document.head.appendChild(estilo);

  setTimeout(() => {
    const cupom = document.querySelector('.cupom-impressao') as HTMLElement | null;
    // Move o cupom para a raiz do body antes de imprimir: dentro de um contêiner com layout
    // (grid/flex) o position:absolute se ancora no contêiner, não na folha.
    const paiOriginal = cupom?.parentElement ?? null;
    const proximoIrmao = cupom?.nextSibling ?? null;
    if (cupom) document.body.appendChild(cupom);

    function restaurar() {
      estilo.remove();
      if (cupom && paiOriginal) {
        if (proximoIrmao) paiOriginal.insertBefore(cupom, proximoIrmao);
        else paiOriginal.appendChild(cupom);
      }
      window.removeEventListener('afterprint', restaurar);
    }
    window.addEventListener('afterprint', restaurar);
    window.print();
  }, 50);
}
