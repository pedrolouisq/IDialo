import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Video, Users } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container animate-fade-in">
      <div className="landing-nav">
        <div className="logo-text">IDialo</div>
        <button className="btn-primary" onClick={() => navigate('/login')}>Entrar</button>
      </div>

      <main className="landing-main">
        <h1 className="hero-title">Conexión Pura.<br/>Privacidad Total.</h1>
        <p className="hero-subtitle">
          Chatea, envía archivos y realiza videollamadas P2P de alta calidad utilizando tu ID único. Sin algoritmos, sin rastreo.
        </p>
        
        <div className="cta-container">
          <button className="btn-cta" onClick={() => navigate('/login')}>Comenzar Ahora</button>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <Zap size={32} color="var(--accent-primary)"/>
            <h3>ID Único Instantáneo</h3>
            <p>Obtén tu identificador único al instante. Nadie puede encontrarte a menos que compartas tu código.</p>
          </div>
          <div className="feature-card">
            <Video size={32} color="var(--accent-primary)"/>
            <h3>Videollamadas P2P</h3>
            <p>Conexión directa entre navegadores. Máxima velocidad y calidad sin servidores intermediarios.</p>
          </div>
          <div className="feature-card">
            <Users size={32} color="var(--accent-primary)"/>
            <h3>Salas Dinámicas</h3>
            <p>Crea grupos sobre la marcha. Invita a tus amigos a espacios compartidos con controles de moderación.</p>
          </div>
          <div className="feature-card">
            <Shield size={32} color="var(--accent-primary)"/>
            <h3>Ultra Privado</h3>
            <p>Tus mensajes no pasan por gigantes tecnológicos. Arquitectura descentralizada en el nodo de conexión.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
