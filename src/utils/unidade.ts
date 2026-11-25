// Sufixo da quantidade conforme o tipo de venda do produto: "un." (padrão) ou "par"/"pares" (venda por par, como brincos).
export function sufixoUnidade(tipoVenda: string | undefined | null, qtd: number): string {
  if (tipoVenda === 'par') return qtd === 1 ? 'par' : 'pares';
  return 'un.';
}
