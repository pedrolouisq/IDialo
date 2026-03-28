import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { API_URL } from '../config';

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isLogin ? `${API_URL}/api/login` : `${API_URL}/api/register`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Autenticación fallida');
      }

      if (isLogin) {
        onLogin(data.token, data.user);
      } else {
        // Switch to login and pre-fill after registration
        setIsLogin(true);
        setPassword('');
        setError('Registro exitoso. Inicia sesión para continuar.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper animate-fade-in">
      <div className="auth-header">
        <h1>IDialo</h1>
        <p>{!isLogin ? 'Únete a la nueva era' : 'Bienvenido de nuevo'}</p>
      </div>

      {error && (
        <div className={`auth-error ${error.includes('exitoso') ? 'success' : ''}`}>
          {error}
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Nombre de usuario" 
          className="input-field"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />
        <input 
          type="password" 
          placeholder="Contraseña" 
          className="input-field"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
          {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
        </button>
      </form>

      <div className="auth-switch">
        <span>{isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
        <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); }}>
          {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
        </button>
      </div>
    </div>
  );
}
