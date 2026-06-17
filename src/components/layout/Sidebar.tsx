import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Users, ShoppingCart, BarChart2, Boxes, TrendingUp, LogOut, Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import './Sidebar.css';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/produtos',   icon: Package,         label: 'Produtos'       },
  { to: '/clientes',   icon: Users,           label: 'Clientes'       },
  { to: '/caixa',      icon: ShoppingCart,    label: 'Caixa'          },
  { to: '/estoque',    icon: Boxes,           label: 'Estoque'        },
  { to: '/relatorios', icon: BarChart2,       label: 'Relatórios'     },
  { to: '/fluxo',      icon: TrendingUp,      label: 'Fluxo de Caixa' },
];

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
  const [logoUrl, setLogoUrl]       = useState('');
  const [aberto, setAberto]         = useState(false);

  useEffect(() => {
    api.get<any>('/api/cliente/config').then(res => {
      if (res?.nome)       setNomeLoja(res.nome);
      if (res?.corPrimaria) setCorPrimaria(res.corPrimaria);
      if (res?.logoUrl)    setLogoUrl(res.logoUrl);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent',        corPrimaria);
    document.documentElement.style.setProperty('--accent-2',      corPrimaria + 'cc');
    document.documentElement.style.setProperty('--accent-bg',     corPrimaria + '1a');
    document.documentElement.style.setProperty('--accent-border', corPrimaria + '40');
  }, [corPrimaria]);

  const logoEl = logoUrl
    ? <img src={logoUrl} alt="Logo" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
    : <div className="sidebar-logo-icon">✦</div>;

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