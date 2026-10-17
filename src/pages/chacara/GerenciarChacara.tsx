import { useState, useEffect, useRef } from 'react';
import { Upload, X, GripVertical } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatarCpf, formatarRg, formatarTelefone, formatarCep } from '../../utils/mascaras';
import './ChacaraForm.css';

const CLOUDINARY_CLOUD = 'dnwnwshvq';
const CLOUDINARY_PRESET = 'chacara-fotos';
const LIMITE_FOTOS = 30;

type Foto = { id: number; url: string; ordem: number };
type Info = {
  descricao: string; endereco: string; comodidades: string; comodidadesExtras: string | null; mapaEmbedUrl: string | null;
  horaEntrada: string; horaSaida: string; avisosUso: string | null;
  locadorNome: string | null; locadorRg: string | null; locadorCpf: string | null; locadorEndereco: string | null; locadorTelefone: string | null;
  cidadeAssinatura: string | null;
};

const COMODIDADES_OPCOES: { chave: string; label: string }[] = [
  { chave: 'piscina', label: 'Piscina' },
  { chave: 'churrasqueira', label: 'Churrasqueira' },
  { chave: 'wifi', label: 'Wi-Fi' },
  { chave: 'estacionamento', label: 'Estacionamento' },
  { chave: 'area_coberta', label: 'Área coberta' },
  { chave: 'playground', label: 'Playground infantil' },
  { chave: 'campo_futebol', label: 'Campo de futebol' },
  { chave: 'salao_festas', label: 'Salão de festas' },
  { chave: 'gerador', label: 'Gerador de energia' },
  { chave: 'ar_condicionado', label: 'Ar-condicionado' },
];

// O contrato usa um único texto de endereço: "Rua, 123 - Cidade/UF". Aqui ele é separado em campos para edição.
function separarEndereco(texto: string | null): { rua: string; numero: string; cidade: string; uf: string } {
  const m = (texto ?? '').match(/^(.*), ([^,]+?) - (.+)\/([A-Za-z]{2})$/);
  if (m) return { rua: m[1], numero: m[2], cidade: m[3], uf: m[4].toUpperCase() };
  return { rua: texto ?? '', numero: '', cidade: '', uf: '' };
}

function juntarEndereco(e: { rua: string; numero: string; cidade: string; uf: string }): string {
  const rua = e.rua.trim(), numero = e.numero.trim(), cidade = e.cidade.trim(), uf = e.uf.trim().toUpperCase();
  if (!rua && !numero && !cidade && !uf) return '';
  // Sem número/cidade/UF preenchidos, mantém só a rua (evita virar texto que o parse não reconhece)
  if (!numero || !cidade || !uf) return [rua, numero, [cidade, uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
  return `${rua}, ${numero} - ${cidade}/${uf}`;
}

type PagamentoCfg = { configurado: boolean; contaPlataforma: boolean; tokenFinal: string | null; publicKey: string | null };

function PagamentoOnline() {
  const [cfg, setCfg] = useState<PagamentoCfg | null>(null);
  const [token, setToken] = useState('');
  const [chave, setChave] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => { api.get<PagamentoCfg>('/api/chacara/info/pagamento').then(setCfg).catch(() => {}); }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await api.put('/api/chacara/info/pagamento', { accessToken: token, publicKey: chave });
      setToken(''); setChave('');
      setCfg(await api.get<PagamentoCfg>('/api/chacara/info/pagamento'));
      sucesso('Conta do Mercado Pago conectada.');
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!window.confirm('Remover a conta do Mercado Pago? Os clientes não poderão mais pagar online.')) return;
    try {
      await api.delete('/api/chacara/info/pagamento');
      setCfg(await api.get<PagamentoCfg>('/api/chacara/info/pagamento'));
      sucesso('Conta removida.');
    } catch (e) {
      toastErro((e as Error).message);
    }
  }

  return (
    <div className="card chacara-card-wide" style={{ marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Pagamento online (Mercado Pago)</div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        O Pix e o cartão das reservas caem direto na sua conta do Mercado Pago. No painel do Mercado Pago, em Seus negócios → Configurações → Credenciais, copie o Access Token e a Public Key de <strong>produção</strong>.
      </p>
      {cfg?.contaPlataforma && (
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Esta chácara usa a conta de pagamento da plataforma. Para trocar, cadastre a conta abaixo.</p>
      )}
      {cfg?.configurado ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ Conta conectada</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Access Token terminado em {cfg.tokenFinal}</span>
          <button className="btn-secondary" onClick={remover}>Remover conta</button>
        </div>
      ) : (!cfg?.contaPlataforma && (
        <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>Nenhuma conta conectada: os clientes não conseguem pagar online até você cadastrar.</p>
      ))}
      <div className="chacara-grid-2">
        <div className="form-group">
          <label className="form-label">Access Token (produção)</label>
          <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="APP_USR-..." />
        </div>
        <div className="form-group">
          <label className="form-label">Public Key (produção)</label>
          <input value={chave} onChange={e => setChave(e.target.value)} placeholder="APP_USR-..." />
        </div>
        <button className="btn-primary" onClick={salvar} disabled={salvando || !token.trim() || !chave.trim()}
          style={{ gridColumn: '1 / -1', justifySelf: 'start', width: 'auto', minWidth: 160 }}>
          {salvando ? 'Validando...' : cfg?.configurado ? 'Atualizar conta' : 'Conectar conta'}
        </button>
      </div>
    </div>
  );
}

export function GerenciarChacara() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [info, setInfo] = useState<Info>({
    descricao: '', endereco: '', comodidades: '', comodidadesExtras: '', mapaEmbedUrl: '',
    horaEntrada: '08:00', horaSaida: '22:00', avisosUso: '',
    locadorNome: '', locadorRg: '', locadorCpf: '', locadorEndereco: '', locadorTelefone: '', cidadeAssinatura: '',
  });
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);
  const [salvandoLocador, setSalvandoLocador] = useState(false);
  const [end, setEnd] = useState({ rua: '', numero: '', cidade: '', uf: '' });
  const [cep, setCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enderecoLiberado, setEnderecoLiberado] = useState(false);
  const [modalCep, setModalCep] = useState<null | 'nao_encontrado' | 'manual'>(null);
  const [carregando, setCarregando] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const { sucesso, erro: toastErro } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<Foto[]>('/api/chacara/fotos'),
      api.get<Info>('/api/chacara/info'),
    ]).then(([f, i]) => { setFotos(f); setInfo(i); const e = separarEndereco(i.locadorEndereco); setEnd(e); setEnderecoLiberado(!!e.rua); })
      .catch(() => toastErro('Erro ao carregar dados da chácara.'))
      .finally(() => setCarregando(false));
  }, []);

  async function uploadFoto(file: File) {
    if (fotos.length >= LIMITE_FOTOS) {
      toastErro(`Limite de ${LIMITE_FOTOS} fotos atingido.`);
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('upload_preset', CLOUDINARY_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Erro no upload');

      const foto = await api.post<Foto>('/api/chacara/fotos', { url: json.secure_url });
      setFotos(f => [...f, foto]);
    } catch (e) {
      toastErro('Erro ao subir foto: ' + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removerFoto(id: number) {
    try {
      await api.delete(`/api/chacara/fotos/${id}`);
      setFotos(f => f.filter(x => x.id !== id));
    } catch (e) {
      toastErro((e as Error).message);
    }
  }

  function definirComoCapa(index: number) {
    const novaLista = [...fotos];
    const [escolhida] = novaLista.splice(index, 1);
    novaLista.unshift(escolhida);
    setFotos(novaLista);
    api.put('/api/chacara/fotos/ordem', { ids: novaLista.map(f => f.id) }).catch(() => {
      toastErro('Erro ao definir capa.');
    });
  }

  function moverFoto(index: number, direcao: -1 | 1) {
    const novaLista = [...fotos];
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= novaLista.length) return;
    [novaLista[index], novaLista[alvo]] = [novaLista[alvo], novaLista[index]];
    setFotos(novaLista);
    api.put('/api/chacara/fotos/ordem', { ids: novaLista.map(f => f.id) }).catch(() => {
      toastErro('Erro ao salvar nova ordem.');
    });
  }

  function toggleComodidade(chave: string) {
    const lista = info.comodidades.split(',').filter(Boolean);
    const nova = lista.includes(chave) ? lista.filter(c => c !== chave) : [...lista, chave];
    setInfo(i => ({ ...i, comodidades: nova.join(',') }));
  }

  async function salvarDescricao() {
    setSalvandoDescricao(true);
    try {
      const atualizado = await api.put<Info>('/api/chacara/info', info);
      setInfo(atualizado);
      sucesso('Descrição e comodidades salvas.');
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoDescricao(false);
    }
  }

  async function aoDigitarCep(valor: string) {
    const formatado = formatarCep(valor);
    setCep(formatado);
    const digitos = formatado.replace(/\D/g, '');
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await res.json();
      if (dados.erro) throw new Error('nao_encontrado');
      setEnd(v => ({
        ...v,
        rua: [dados.logradouro, dados.bairro].filter(Boolean).join(', '),
        cidade: dados.localidade ?? '',
        uf: (dados.uf ?? '').toUpperCase(),
      }));
      setEnderecoLiberado(true);
    } catch {
      setModalCep('nao_encontrado');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvarLocador() {
    setSalvandoLocador(true);
    try {
      const atualizado = await api.put<Info>('/api/chacara/info', { ...info, locadorEndereco: juntarEndereco(end) });
      setInfo(atualizado);
      setEnd(separarEndereco(atualizado.locadorEndereco));
      sucesso('Meus dados salvos.');
    } catch (e) {
      toastErro((e as Error).message);
    } finally {
      setSalvandoLocador(false);
    }
  }

  if (carregando) return <div className="page"><p>Carregando...</p></div>;

  const comodidadesAtivas = info.comodidades.split(',').filter(Boolean);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fotos e Descrição</h1>
          <p className="page-subtitle">Gerencie as fotos, endereço e comodidades da chácara</p>
        </div>
      </div>

      {/* Galeria de fotos */}
      <div className="card chacara-card-wide">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Fotos ({fotos.length}/{LIMITE_FOTOS})</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          A primeira foto é a capa. Use as setas para reordenar.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 14 }}>
          {fotos.map((foto, i) => (
            <div key={foto.id} style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={foto.url} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removerFoto(foto.id)} style={{
                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none',
                borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <X size={12} color="#fff" />
              </button>
              <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 4 }}>
                <button onClick={() => moverFoto(i, -1)} disabled={i === 0} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>◀</button>
                <button onClick={() => moverFoto(i, 1)} disabled={i === fotos.length - 1} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>▶</button>
                {i !== 0 && (
                  <button onClick={() => definirComoCapa(i)} title="Definir como capa" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>★</button>
                )}
              </div>
              {i === 0 && (
                <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>Capa</span>
              )}
            </div>
          ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); if (fileRef.current) fileRef.current.value = ''; }} />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading || fotos.length >= LIMITE_FOTOS}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {uploading ? <>Enviando...</> : <><Upload size={14} /> Adicionar foto</>}
        </button>
      </div>

      {/* Descrição e endereço */}
      <div className="card chacara-card-wide" style={{ marginTop: 20 }}>
        <div className="chacara-grid-2">
          <div className="form-group chacara-full">
            <label className="form-label">Descrição</label>
            <textarea rows={4} value={info.descricao}
              onChange={e => setInfo(i => ({ ...i, descricao: e.target.value }))}
              placeholder="Conte sobre a chácara: estrutura, capacidade, diferenciais..." />
          </div>

          <div className="form-group">
            <label className="form-label">Endereço completo</label>
            <input value={info.endereco}
              onChange={e => setInfo(i => ({ ...i, endereco: e.target.value }))}
              placeholder="Rua, número, bairro, cidade - UF" />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Texto simples (não cole link aqui). Usado só como referência visual no site.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Link do mapa (opcional)</label>
            <input value={info.mapaEmbedUrl ?? ''}
              onChange={e => setInfo(i => ({ ...i, mapaEmbedUrl: e.target.value }))}
              placeholder="https://www.google.com/maps/embed?..." />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              No Google Maps: encontre o local → Compartilhar → aba "Incorporar um mapa" → copie só o link dentro de <code>src="..."</code> do código gerado. Se deixar em branco, o mapa é gerado automaticamente a partir do endereço acima.
            </p>
          </div>

          <div className="form-group chacara-full">
            <label className="form-label">Comodidades</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {COMODIDADES_OPCOES.map(op => {
                const ativa = comodidadesAtivas.includes(op.chave);
                return (
                  <button key={op.chave} type="button" onClick={() => toggleComodidade(op.chave)}
                    className={ativa ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: 12, padding: '6px 12px' }}>
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group chacara-full">
            <label className="form-label">Outras comodidades (opcional)</label>
            <textarea rows={3} value={info.comodidadesExtras ?? ''}
              onChange={e => setInfo(i => ({ ...i, comodidadesExtras: e.target.value }))}
              placeholder={'Uma por linha, ex:\nLago para pesca\nQuadra de vôlei'} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Horário de entrada</label>
              <input type="time" value={info.horaEntrada} onChange={e => setInfo(i => ({ ...i, horaEntrada: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Horário de saída</label>
              <input type="time" value={info.horaSaida} onChange={e => setInfo(i => ({ ...i, horaSaida: e.target.value }))} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -8 }}>
            Mostrado pro cliente no site — se ele reservar 2 dias, entrada continua sendo neste horário no 1º dia e saída neste horário no último dia.
          </p>

          <div className="form-group chacara-full">
            <label className="form-label">Avisos e regras de uso (opcional)</label>
            <textarea rows={8} value={info.avisosUso ?? ''}
              onChange={e => setInfo(i => ({ ...i, avisosUso: e.target.value }))}
              placeholder={'Uma regra por linha, ex:\nAo sair, guardar cadeiras e mesas no lugar\nFechar banheiros e quartos com a chave\nProibido narguilé em cima da mesa de madeira'} />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Mostrado pro cliente antes de ele confirmar a reserva, pra ele estar ciente das regras.
            </p>
          </div>

          <button className="btn-primary" onClick={salvarDescricao} disabled={salvandoDescricao} style={{ gridColumn: '1 / -1', justifySelf: 'start', width: 'auto', minWidth: 160 }}>
            {salvandoDescricao ? 'Salvando...' : 'Salvar informações'}
          </button>
        </div>
      </div>

      {/* Dados do locador (contrato) */}
      <div className="card chacara-card-wide" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Meus dados (Locador)</div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
          Usados para preencher automaticamente o contrato de locação gerado nas reservas.
        </p>
        <div className="chacara-grid-2">
          <div className="chacara-full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '3 1 260px' }}>
              <label className="form-label">Nome completo</label>
              <input value={info.locadorNome ?? ''} onChange={e => setInfo(i => ({ ...i, locadorNome: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: '1 1 130px' }}>
              <label className="form-label">RG</label>
              <input value={info.locadorRg ?? ''} onChange={e => setInfo(i => ({ ...i, locadorRg: formatarRg(e.target.value) }))} inputMode="numeric" placeholder="00.000.000-0" />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label className="form-label">CPF</label>
              <input value={info.locadorCpf ?? ''} onChange={e => setInfo(i => ({ ...i, locadorCpf: formatarCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" />
            </div>
          </div>
          <div className="chacara-full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '0 1 160px' }}>
              <label className="form-label">CEP</label>
              <input value={cep} onChange={e => aoDigitarCep(e.target.value)} inputMode="numeric" placeholder="00000-000" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', paddingBottom: 12 }}>
              {buscandoCep ? 'Buscando CEP...' : enderecoLiberado ? '' : 'Informe o CEP para liberar o endereço.'}
              {!enderecoLiberado && !buscandoCep && (
                <> <button type="button" className="btn-ghost" style={{ padding: '0 4px', fontSize: 12, textDecoration: 'underline' }} onClick={() => setModalCep('manual')}>Preencher manualmente</button></>
              )}
            </div>
          </div>
          <div className="chacara-full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '3 1 240px' }}>
              <label className="form-label">Endereço</label>
              <input disabled={!enderecoLiberado} value={end.rua} onChange={e => setEnd(v => ({ ...v, rua: e.target.value }))} placeholder="Rua, bairro" />
            </div>
            <div className="form-group" style={{ flex: '0 1 90px' }}>
              <label className="form-label">Número</label>
              <input disabled={!enderecoLiberado} value={end.numero} onChange={e => setEnd(v => ({ ...v, numero: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: '2 1 160px' }}>
              <label className="form-label">Cidade</label>
              <input disabled={!enderecoLiberado} value={end.cidade} onChange={e => setEnd(v => ({ ...v, cidade: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: '0 1 70px' }}>
              <label className="form-label">UF</label>
              <input disabled={!enderecoLiberado} value={end.uf} maxLength={2} onChange={e => setEnd(v => ({ ...v, uf: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="chacara-full" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 180px' }}>
              <label className="form-label">Telefone</label>
              <input value={info.locadorTelefone ?? ''} onChange={e => setInfo(i => ({ ...i, locadorTelefone: formatarTelefone(e.target.value) }))} inputMode="tel" placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group" style={{ flex: '1 1 240px' }}>
              <label className="form-label">Cidade para assinatura do contrato</label>
              <input value={info.cidadeAssinatura ?? ''} onChange={e => setInfo(i => ({ ...i, cidadeAssinatura: e.target.value }))}
                placeholder="Ex: Campo Grande – MS" />
            </div>
          </div>
          <button className="btn-primary" onClick={salvarLocador} disabled={salvandoLocador} style={{ gridColumn: '1 / -1', justifySelf: 'start', width: 'auto', minWidth: 160 }}>
            {salvandoLocador ? 'Salvando...' : 'Salvar meus dados'}
          </button>
        </div>
      </div>

      {modalCep && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCep(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h3>{modalCep === 'nao_encontrado' ? 'CEP não encontrado' : 'Preencher manualmente'}</h3></div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>
                {modalCep === 'nao_encontrado'
                  ? 'Não encontramos esse CEP. Confira se digitou certo, ou preencha o endereço manualmente.'
                  : 'Você vai preencher o endereço sem buscar pelo CEP. Confira rua, número, cidade e UF com atenção, pois eles vão para o contrato.'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Ao clicar em OK, os campos de endereço serão liberados.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalCep(null)}>Corrigir CEP</button>
              <button className="btn-primary" onClick={() => { setEnderecoLiberado(true); setModalCep(null); }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <PagamentoOnline />
    </div>
  );
}