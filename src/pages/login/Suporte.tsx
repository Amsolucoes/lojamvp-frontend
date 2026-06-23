import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Suporte() {
  const navigate = useNavigate();
  const { setSessao } = useAuth();
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;

    try {
      const hash = window.location.hash.slice(1); // remove o #
      if (!hash) { navigate('/login', { replace: true }); return; }

      const dados = JSON.parse(decodeURIComponent(hash));
      if (dados.token) {
        setSessao({
          token: dados.token,
          nome: dados.nome ?? 'Suporte',
          email: dados.email ?? '',
          role: (dados.role as 'admin' | 'operador') ?? 'admin',
        });
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch {
      navigate('/login', { replace: true });
    }
  }, [navigate, setSessao]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>
      Entrando na loja...
    </div>
  );
}