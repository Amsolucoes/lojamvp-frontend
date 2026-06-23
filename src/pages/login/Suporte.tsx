import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Suporte() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSessao } = useAuth();
  const feito = useRef(false);

  useEffect(() => {
    if (feito.current) return;
    feito.current = true;

    const token = params.get('token');
    const nome = params.get('nome') ?? 'Suporte';
    const email = params.get('email') ?? '';
    const role = (params.get('role') as 'admin' | 'operador') ?? 'admin';

    if (token) {
      setSessao({ token, nome, email, role });
      navigate('/', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [params, navigate, setSessao]);

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#888', fontFamily: 'sans-serif' }}>
      Entrando na loja...
    </div>
  );
}