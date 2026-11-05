// Soma o estoque das variações ativas (mesma regra do backend para o estoque do produto com grade).
export function totalVariacoes(variacoes?: { estoque: number; ativo?: boolean }[] | null): number {
  return (variacoes ?? []).filter(v => v.ativo !== false).reduce((soma, v) => soma + (Number(v.estoque) || 0), 0);
}
