// Normaliza para comparação: sem acentos, sem maiúsculas e sem espaços nas pontas.
export function normalizarTexto(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Busca "contém" que ignora acento e maiúscula/minúscula.
export function contemTexto(texto: string | null | undefined, busca: string): boolean {
  const b = normalizarTexto(busca);
  return !b || normalizarTexto(texto).includes(b);
}

// "2027-01-10" -> "jan/2027" (para textos como "a partir de jan/2027")
export function rotuloMesAno(data?: string | null): string {
  if (!data) return '';
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [ano, mes] = data.slice(0, 10).split('-').map(Number);
  return ano && mes ? `${meses[mes - 1]}/${ano}` : '';
}
