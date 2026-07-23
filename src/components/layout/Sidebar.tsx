import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, BarChart2, Boxes, 
  TrendingUp, LogOut, Menu, X, Scissors, Calendar, CreditCard, Wallet, Users2, Filter, Settings, FileText, HelpCircle, Home, Image, CalendarHeart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { carregarTemaSalvo } from '../../utils/tema';
import './Sidebar.css';

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function Sidebar() {
  const { produtos } = useApp();
  const { usuario, logout } = useAuth();

  const alertas = produtos.filter(p => {
    if (!p.ativo) return false;
    const vars = (p as any).variacoes?.filter((v: any) => v.ativo);
    if (vars?.length > 0) return vars.some((v: any) => v.estoque > 0 && v.estoque <= v.estoqueMinimo);
    return p.estoque > 0 && p.estoque <= p.estoqueMinimo;
  }).length;
  
  const [nomeLoja, setNomeLoja]     = useState('Minha Loja');
  const [corPrimaria, setCorPrimaria] = useState('#e8945a');
  const [temaPessoal, setTemaPessoal] = useState(carregarTemaSalvo());

  useEffect(() => {
    function ouvirMudancaDeTema() { setTemaPessoal(carregarTemaSalvo()); }
    window.addEventListener('temaAlterado', ouvirMudancaDeTema);
    return () => window.removeEventListener('temaAlterado', ouvirMudancaDeTema);
  }, []);

  const [logoUrl, setLogoUrl]       = useState('');
  const [aberto, setAberto]         = useState(false);
  const [tipoPlano, setTipoPlano]   = useState('loja');
  const [modulos, setModulos]       = useState<string[]>([]);

  useEffect(() => {
    api.get<any>('/api/cliente/config').then(res => {
      if (res?.nome)       setNomeLoja(res.nome);
      if (res?.corPrimaria) setCorPrimaria(res.corPrimaria);
      if (res?.logoUrl)    setLogoUrl(res.logoUrl);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function carregarSituacao() {
      api.get<any>('/api/loja/situacao').then(res => {
        if (res?.tipoPlano) setTipoPlano(res.tipoPlano);
        if (Array.isArray(res?.modulosAtivos)) setModulos(res.modulosAtivos);
      }).catch(() => {});
    }
    carregarSituacao();
    window.addEventListener('modulosAlterados', carregarSituacao);
    return () => window.removeEventListener('modulosAlterados', carregarSituacao);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (temaPessoal === 'escuro') {
      // Tema padrão — usa a cor de marca da loja
      html.style.setProperty('--accent',        corPrimaria);
      html.style.setProperty('--accent-2',      corPrimaria + 'cc');
      html.style.setProperty('--accent-bg',     corPrimaria + '1a');
      html.style.setProperty('--accent-border', corPrimaria + '40');
    } else {
      // Tema claro escolhido pelo usuário — deixa a classe CSS do tema vencer
      html.style.removeProperty('--accent');
      html.style.removeProperty('--accent-2');
      html.style.removeProperty('--accent-bg');
      html.style.removeProperty('--accent-border');
    }
  }, [corPrimaria, temaPessoal]);

  const logoEl = logoUrl
    ? <img src={logoUrl} alt="Logo" style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
    : <img src="/logo-aldevsoftware-padrao.png" alt="AlDevSoftware" style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />;

  const temServicos = modulos.includes('servicos');
  const soServicos = tipoPlano === 'servicos';
  const soFinanceiro = tipoPlano === 'financeiro';
  const temFinanceiro = modulos.includes('financeiro') || soFinanceiro;
  const temTurmas = modulos.includes('turmas');
  const temCorretora = modulos.includes('corretora');
  const temProdutos = tipoPlano === 'loja' || tipoPlano === 'loja_modulos';
  const temNf = modulos.includes('nf') && temProdutos;
  const temChacaraReservas = modulos.includes('chacara_reservas');

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard'      },
    ...(temProdutos ? [{ to: '/produtos', icon: Package, label: 'Produtos' }] : []),
    ...(temProdutos || temServicos || temTurmas || temCorretora ? [{ to: '/clientes', icon: Users, label: temTurmas && !temProdutos && !temServicos ? 'Alunos' : 'Clientes' }] : []),
    ...(temProdutos || temServicos ? [{ to: '/caixa', icon: ShoppingCart, label: 'Caixa' }] : []),
    ...(temServicos ? [{ to: '/servicos', icon: Scissors, label: 'Serviços' }] : []),
    ...(temServicos ? [{ to: '/agenda', icon: Calendar, label: 'Agenda' }] : []),
    ...(temServicos || temTurmas ? [{ to: '/planos', icon: CreditCard, label: 'Planos' }] : []),
    ...(temProdutos ? [{ to: '/estoque', icon: Boxes, label: 'Estoque' }] : []),
    ...(temNf ? [{ to: '/nf', icon: FileText, label: 'Importar NF' }] : []),
    ...(temFinanceiro ? [{ to: '/financeiro', icon: Wallet, label: 'Financeiro' }] : []),
    ...(temTurmas ? [{ to: '/turmas', icon: Users2, label: 'Turmas' }] : []),
    ...(temCorretora ? [{ to: '/funil', icon: Filter, label: 'Funil de Vendas' }] : []),
    ...(temChacaraReservas ? [{ to: '/chacara/preco', icon: Home, label: 'Preço das Reservas' }] : []),
    ...(temChacaraReservas ? [{ to: '/chacara/info', icon: Image, label: 'Fotos e Descrição' }] : []),
    ...(temChacaraReservas ? [{ to: '/chacara/datas-especiais', icon: CalendarHeart, label: 'Datas Especiais' }] : []),
    ...(temChacaraReservas ? [{ to: '/chacara/reservas', icon: Calendar, label: 'Reservas' }] : []),
    ...(temProdutos || temServicos ? [{ to: '/relatorios', icon: BarChart2, label: 'Relatórios' }] : []),
    ...(temProdutos || temServicos ? [{ to: '/fluxo', icon: TrendingUp, label: 'Fluxo de Caixa' }] : []),
    { to: '/ajuda', icon: HelpCircle, label: 'Central de Ajuda' },
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
  ];

  return (
    <>
      {/* Topbar mobile */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logoEl}
          <div className="sidebar-logo-name">{nomeLoja}</div>
        </div>
        <button className="btn-ghost" onClick={() => setAberto(v => !v)} style={{ padding: 8 }}>
          {aberto ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Overlay */}
      {aberto && <div className="sidebar-overlay" onClick={() => setAberto(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${aberto ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          {logoEl}
          <div>
            <div className="sidebar-logo-name">{nomeLoja}</div>
            <div className="sidebar-logo-sub">Gestão</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => setAberto(false)}>
              <Icon size={16} />
              <span>{label}</span>
              {label === 'Estoque' && alertas > 0 && (
                <span className="sidebar-badge">{alertas}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{iniciais(usuario?.nome ?? 'U')}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-nome">{usuario?.nome}</div>
            <div className="sidebar-user-role">{usuario?.role === 'admin' ? 'Administrador' : 'Operador'}</div>
          </div>
          <button className="btn-ghost sidebar-logout" onClick={logout} title="Sair">
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}