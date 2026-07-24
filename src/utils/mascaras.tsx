export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

/**
 * Busca endereço pelo CEP via ViaCEP.
 * Retorna a string formatada (rua, bairro, cidade - UF) ou null se não encontrar/falhar.
 */
export async function buscarEnderecoPorCep(valor: string): Promise<string | null> {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    const dados = await res.json();
    if (dados.erro) return null;

    const partes = [dados.logradouro, dados.bairro, dados.localidade && dados.uf ? `${dados.localidade} - ${dados.uf}` : '']
      .filter(Boolean);
    return partes.join(', ');
  } catch {
    return null;
  }
}