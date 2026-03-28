import { useState, useRef } from 'react';
import { X, Save, Palette, Camera } from 'lucide-react';
import { API_URL } from '../config';

export default function ProfileModal({ user, token, onClose, onUserUpdate }) {
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [theme, setTheme] = useState(user.theme || 'default');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, avatar, theme })
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate(data.user);
        onClose();
      } else {
        alert("Error al guardar perfil.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión salvando el perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <X className="modal-close" onClick={onClose} />
        <h2 style={{marginTop:0, marginBottom:'24px', textAlign:'center'}}>Tu Perfil</h2>
        
        <form onSubmit={handleSave} style={{display:'flex', flexDirection:'column'}}>
          <img 
            src={avatar || `https://ui-avatars.com/api/?name=${user.id}&background=random`} 
            className="avatar-preview" 
            onClick={() => fileInputRef.current?.click()}
            title="Cambiar Foto"
          />
          <div className="avatar-upload-hint" onClick={() => fileInputRef.current?.click()}>Haz clic para cambiar tu foto</div>
          <input type="file" accept="image/*" style={{display:'none'}} ref={fileInputRef} onChange={handleImageUpload}/>
          
          <div className="form-group">
            <label>Nombre a mostrar</label>
            <input 
              className="form-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required
            />
          </div>

          <div className="form-group" style={{opacity:0.6}}>
            <label>ID Único (No modificable)</label>
            <input className="form-input" value={user.id} disabled />
          </div>

          <div className="form-group">
            <label>Tema Visual</label>
            <select 
              className="form-input" 
              value={theme} 
              onChange={e => setTheme(e.target.value)}
              style={{cursor:'pointer'}}
            >
              <option value="default">✨ Default (Neón Púrpura)</option>
              <option value="matrix">💻 Matrix (Verde Hacker)</option>
              <option value="ocean">🌊 Océano (Azul Profundo)</option>
              <option value="cyberpunk">🌃 Cyberpunk (Fucsia Neón)</option>
            </select>
          </div>

          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
