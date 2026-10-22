// Normaliza para comparação: sem acentos, sem maiúsculas e sem espaços nas pontas.
export function normalizarTexto(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Busca "contém" que ignora acento e maiúscula/minúscula.
export function contemTexto(texto: string | null | undefined, busca: string): boolean {
  const b = normalizarTexto(busca);
  return !b || normalizarTexto(texto).includes(b);
}
