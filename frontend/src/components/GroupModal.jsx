import { useState, useEffect } from 'react';
import { X, Users, Save, Edit2 } from 'lucide-react';
import { API_URL } from '../config';

export default function GroupModal({ group, token, onClose, onGroupUpdate }) {
  const [name, setName] = useState(group.username || group.name);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/groups/${encodeURIComponent(group.id)}/members`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.members) setMembers(data.members);
      setLoadingMembers(false);
    })
    .catch(err => {
      console.error(err);
      setLoadingMembers(false);
    });
  }, [group.id, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${encodeURIComponent(group.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        // El servidor emitirá group_updated a todos, pero lo forzamos local
        onGroupUpdate({ ...group, username: data.group.name, name: data.group.name });
        onClose();
      } else {
        alert("Error actualizando sala.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al actualizar la sala.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <X className="modal-close" onClick={onClose} />
        <h2 style={{marginTop:0, marginBottom:'24px', textAlign:'center'}}>Sala: {group.username}</h2>
        
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre de la Sala</label>
            <input 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar y Notificar a Todos'}
          </button>
        </form>

        <h3 style={{marginTop:'32px', marginBottom:'16px'}}>Miembros ({members.length})</h3>
        {loadingMembers ? (
          <div>Cargando...</div>
        ) : (
          <div className="group-members">
            {members.map(m => (
              <div key={m.id} className="group-member-item">
                <img src={m.avatar || `https://ui-avatars.com/api/?name=${m.id}&background=random`} />
                <div>
                  <div style={{fontWeight:600}}>{m.username}</div>
                  <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{m.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
