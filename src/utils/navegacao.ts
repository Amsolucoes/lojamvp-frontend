// Destino do botão "voltar" das telas internas do Financeiro: no celular volta ao Dashboard (visão móvel do
// financeiro); no computador, à tela do Financeiro.
export function destinoVoltarFinanceiro(): string {
  try {
    return window.matchMedia('(max-width: 768px)').matches ? '/' : '/financeiro';
  } catch {
    return '/financeiro';
  }
}
