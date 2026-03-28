import { useState, useEffect, useRef } from 'react';  
import { io } from 'socket.io-client';  
import { Search, Send, LogOut, MessageSquare, Copy, Image as ImageIcon, Video, X, Users, Settings, Info, Mic, Square, Reply, Trash2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import CryptoJS from 'crypto-js';
import VideoCallModal from './VideoCallModal';
import ProfileModal from './ProfileModal';
import GroupModal from './GroupModal';
import { API_URL } from '../config';

export default function Dashboard({ user, token, onLogout, onUserUpdate }) {
  const [socket, setSocket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  
  const [friends, setFriends] = useState([]); 
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const [activeChat, setActiveChat] = useState(null); 
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [activeCall, setActiveCall] = useState(null); // { targetId, isIncoming, offer }
  const [copied, setCopied] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeChatRef = useRef(null);
  const friendsRef = useRef([]);

  const getE2EKey = (targetId) => {
    return [user.id, targetId].sort().join('-') + '-s3cr3t';
  };

  const encryptPayload = (data, isGroup, targetId) => {
    if (isGroup) return data;
    const key = getE2EKey(targetId);
    return {
      text: data.text ? CryptoJS.AES.encrypt(data.text, key).toString() : '',
      image: data.image ? CryptoJS.AES.encrypt(data.image, key).toString() : null,
      audio: data.audio ? CryptoJS.AES.encrypt(data.audio, key).toString() : null,
      replyTo: data.replyTo || null
    };
  };

  const decryptPayload = (msg) => {
    if (msg.to.includes('@')) return msg;
    const otherId = msg.from === user.id ? msg.to : msg.from;
    const key = getE2EKey(otherId);
    try {
      const decText = msg.text ? CryptoJS.AES.decrypt(msg.text, key).toString(CryptoJS.enc.Utf8) : '';
      const decImage = msg.image ? CryptoJS.AES.decrypt(msg.image, key).toString(CryptoJS.enc.Utf8) : null;
      const decAudio = msg.audio ? CryptoJS.AES.decrypt(msg.audio, key).toString(CryptoJS.enc.Utf8) : null;
      return { ...msg, text: decText, image: decImage, audio: decAudio };
    } catch (e) {
      console.error("Failed to decrypt msg", e);
      return { ...msg, text: "🔒 Mensaje Cifrado", image: null, audio: null };
    }
  };

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);

  useEffect(() => {
    // Request Notifications
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('authenticate', token);
    });

    const savedFriends = localStorage.getItem(`friends_${user.id}`);
    if (savedFriends) setFriends(JSON.parse(savedFriends));

    newSocket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('receive_message', (rawMsg) => {
      const msg = decryptPayload(rawMsg);
      const currentChat = activeChatRef.current;
      const currentFriends = friendsRef.current;
      // Si el mensaje es para el chat activo
      if (currentChat && (msg.to === currentChat.id || msg.from === currentChat.id)) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }

      // Notification
      if (msg.from !== user.id && (!currentChat || currentChat.id !== msg.from)) {
        if (Notification.permission === 'granted' && document.hidden) {
           new Notification('Nuevo Mensaje en NovaChat', { body: 'Tienes un nuevo mensaje de ' + msg.from });
        }
      }

      // Add to friends line if not exists
      const otherId = msg.from === user.id ? msg.to : msg.from;
      if (!currentFriends.find(f => f.id === otherId)) {
        fetch(`${API_URL}/api/search?id=${encodeURIComponent(otherId)}`)
          .then(res => res.json())
          .then(data => {
            if(data.user) {
              setFriends(prev => {
                if (prev.find(x => x.id === data.user.id)) return prev;
                const arr = [...prev, data.user];
                localStorage.setItem(`friends_${user.id}`, JSON.stringify(arr));
                return arr;
              });
            }
          });
      }
    });

    newSocket.on('typing', ({from}) => {
      setTypingUsers(prev => ({...prev, [from]: true}));
    });
    newSocket.on('stop_typing', ({from}) => {
      setTypingUsers(prev => ({...prev, [from]: false}));
    });

    newSocket.on('message_updated', (rawMsg) => {
      const msg = decryptPayload(rawMsg);
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    // P2P Incoming Call
    newSocket.on('call_offer', ({ from, offer }) => {
       setActiveCall(prev => {
         if (!prev) return { targetId: from, isIncoming: true, offer };
         return prev;
       });
    });

    newSocket.on('user_updated', (updatedData) => {
      setFriends(prev => prev.map(f => f.id === updatedData.id ? { ...f, ...updatedData } : f));
      setActiveChat(prev => (prev && prev.id === updatedData.id) ? { ...prev, ...updatedData } : prev);
    });

    newSocket.on('group_updated', (updatedData) => {
      setFriends(prev => prev.map(f => f.id === updatedData.id ? { ...f, username: updatedData.name, name: updatedData.name } : f));
      setActiveChat(prev => (prev && prev.id === updatedData.id) ? { ...prev, username: updatedData.name, name: updatedData.name } : prev);
    });

    return () => newSocket.disconnect();
  }, [token, user.id]);

  useEffect(() => {
    if (!activeChat) return;
    
    fetch(`${API_URL}/api/messages/${encodeURIComponent(activeChat.id)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        const decryptedHistory = data.map(decryptPayload).sort((a,b) => a.timestamp - b.timestamp);
        setMessages(decryptedHistory);
        setTimeout(scrollToBottom, 100);
      }
    })
    .catch(err => console.error("Error", err));

    if (activeChat.isGroup && socket) {
      socket.emit('join_group_room', activeChat.id);
    }

  }, [activeChat, token, socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const createGroup = async () => {
    const groupName = prompt("Nombre del Grupo:");
    if (!groupName) return;
    try {
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST', headers: { 'Content-Type':'application/json'},
        body: JSON.stringify({ name: groupName, creatorId: user.id })
      });
      const data = await res.json();
      const updatedFriends = [...friends, data.group];
      setFriends(updatedFriends);
      localStorage.setItem(`friends_${user.id}`, JSON.stringify(updatedFriends));
      setActiveChat(data.group);
      socket.emit('join_group_room', data.group.id);
    } catch(err) {
      alert("Error creando grupo");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    if (!searchQuery) return;
    
    try {
      const res = await fetch(`${API_URL}/api/search?id=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      const isNew = !friends.find(f => f.id === data.user.id);
      if (isNew) {
        if (data.user.isGroup) {
          await fetch(`${API_URL}/api/groups/join`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ groupId: data.user.id, userId: user.id })
          });
          socket.emit('join_group_room', data.user.id);
        }
        const updatedFriends = [...friends, data.user];
        setFriends(updatedFriends);
        localStorage.setItem(`friends_${user.id}`, JSON.stringify(updatedFriends));
      }
      setActiveChat(data.user);
      setSearchQuery('');
    } catch (err) {
      setSearchError(err.message);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activeChat) return;

    socket.emit('typing', { to: activeChat.id });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { to: activeChat.id });
    }, 1500);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImagePreview(ev.target.result) };
    reader.readAsDataURL(file);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !imagePreview) || !activeChat) return;
    
    const payload = { text: inputText, image: imagePreview, audio: null, replyTo: replyingTo ? replyingTo.id : null };
    const encrypted = encryptPayload(payload, activeChat.isGroup, activeChat.id);

    socket.emit('send_message', { 
      to: activeChat.id, 
      text: encrypted.text,
      image: encrypted.image,
      audio: encrypted.audio,
      replyTo: encrypted.replyTo
    });
    socket.emit('stop_typing', { to: activeChat.id });
    
    setInputText('');
    setImagePreview(null);
    setReplyingTo(null);
  };

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startCall = () => {
    if (!activeChat || activeChat.isGroup) return;
    setActiveCall({ targetId: activeChat.id, isIncoming: false });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const payload = { text: '', image: null, audio: reader.result, replyTo: replyingTo ? replyingTo.id : null };
          const encrypted = encryptPayload(payload, activeChat.isGroup, activeChat.id);
          socket.emit('send_message', { 
            to: activeChat.id, 
            text: encrypted.text,
            audio: encrypted.audio,
            image: encrypted.image,
            replyTo: encrypted.replyTo
          });
          setReplyingTo(null);
        };
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearChat = async () => {
    if (!activeChat) return;
    if (!window.confirm("¿Estás seguro de que quieres borrar todo el historial de este chat? Esta acción no se puede deshacer y liberará espacio en la base de datos.")) return;
    
    try {
      await fetch(`${API_URL}/api/messages/${encodeURIComponent(activeChat.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessages([]);
    } catch (err) {
      alert("Error al borrar el chat.");
    }
  };

  return (
    <div className={`dashboard animate-fade-in ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${activeChat ? 'chat-active' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-profile">
            {!isSidebarCollapsed && (
              <div className="user-info" onClick={() => setShowProfile(true)} style={{cursor: 'pointer'}} title="Editar Perfil">
                <span className="user-name">{user.username} <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.id}&background=random`} style={{width:'24px', verticalAlign:'middle', borderRadius:'50%', marginLeft: '8px', background:'var(--bg-secondary)'}}/></span>
                <span className="user-id" onClick={(e) => { e.stopPropagation(); copyId(); }} title="Copiar ID" style={{display:'flex', alignItems:'center', gap:'4px'}}>
                  {user.id} <Copy size={12}/>
                </span>
              </div>
            )}
            <div style={{display:'flex', flexDirection: isSidebarCollapsed ? 'column' : 'row', gap: isSidebarCollapsed ? '8px' : '0'}}>
              {!isSidebarCollapsed && (
                <>
                  <button className="btn-icon" onClick={() => setShowProfile(true)} title="Ajustes"><Settings size={18} /></button>
                  <button className="btn-icon" onClick={createGroup} title="Crear Grupo"><Users size={18} /></button>
                </>
              )}
              <button className="btn-icon mobile-hide" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title={isSidebarCollapsed?"Expandir":"Colapsar"}>
                {isSidebarCollapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
              </button>
              <button className="btn-icon" onClick={onLogout} title="Cerrar Sesión">
                <LogOut size={18} />
              </button>
            </div>
          </div>
          {!isSidebarCollapsed && (
            <form className="search-bar" onSubmit={handleSearch}>
              <input 
                type="text" 
                placeholder="Buscar amigo..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-icon">
                <Search size={20} color="var(--accent-primary)" />
              </button>
            </form>
          )}
          {!isSidebarCollapsed && searchError && <div style={{color:'var(--error-color)', fontSize:'0.8rem', marginTop:'8px'}}>{searchError}</div>}
        </div>
        
        <div className="friends-list">
          {friends.length === 0 ? (
            !isSidebarCollapsed && (
              <div style={{color:'var(--text-muted)', textAlign:'center', marginTop:'20px', fontSize:'0.9rem'}}>
                Busca a tus amigos mediante su ID.
              </div>
            )
          ) : (
            friends.map(friend => {
              const isActive = activeChat?.id === friend.id;
              const isOnline = onlineUsers.includes(friend.id);
              return (
                <div key={friend.id} className={`friend-item ${isActive ? 'active' : ''}`} onClick={() => setActiveChat(friend)} title={isSidebarCollapsed ? friend.username : ''}>
                  {!friend.isGroup ? 
                    <img className="friend-avatar" src={friend.avatar || `https://ui-avatars.com/api/?name=${friend.id}&background=random`} /> : 
                    <div className="friend-avatar"><Users size={24}/></div>
                  }
                  {!friend.isGroup && isOnline && <div className="status-dot"></div>}
                  
                  {!isSidebarCollapsed && (
                    <div className="friend-info">
                      <div className="friend-name">{friend.username}</div>
                      {typingUsers[friend.id] ? (
                        <div className="typing-preview">escribiendo...</div>
                      ) : (
                        <div className="friend-sub">{friend.id}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="chat-area">
        {activeChat ? (
          <>
            <div className="chat-header" style={{position: 'relative'}}>
              <div 
                style={{display:'flex', alignItems:'center'}} 
              >
                <button className="btn-icon mobile-only" onClick={() => setActiveChat(null)} style={{marginRight: '12px'}}>
                  <ArrowLeft size={20}/>
                </button>
                <div 
                  style={{display:'flex', alignItems:'center', cursor: activeChat.isGroup ? 'pointer' : 'default'}} 
                  onClick={() => { if(activeChat.isGroup) setShowGroupInfo(true) }}
                  title={activeChat.isGroup ? "Ver Detalles del Grupo" : ""}
                >
                  {!activeChat.isGroup ? 
                     <img className="friend-avatar" src={activeChat.avatar || `https://ui-avatars.com/api/?name=${activeChat.id}&background=random`} style={{marginRight:'12px'}} /> : 
                     <div className="friend-avatar"><Users size={24}/></div>
                  }
                  <div>
                    <div style={{fontWeight:'600', fontSize:'1.1rem'}}>{activeChat.username}</div>
                    <div className="mobile-hide" style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
                      {activeChat.id} {activeChat.isGroup && '(Click para info)'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="header-actions" style={{marginRight: '40px'}}>
                {!activeChat.isGroup && (
                  <button className="btn-primary" style={{padding:'8px 16px', fontSize:'0.9rem'}} onClick={startCall}>
                    <Video size={16}/> Llamar
                  </button>
                )}
              </div>
              <button 
                className="btn-icon" 
                onClick={clearChat} 
                style={{
                  position: 'absolute', 
                  top: '12px', 
                  right: '12px', 
                  color: 'var(--text-muted)',
                  opacity: 0.6
                }} 
                title="Borrar historial del chat"
              >
                <Trash2 size={16}/>
              </button>
            </div>
            
            <div className="chat-messages">
              {messages.map((msg, i) => {
                const isSent = msg.from === user.id;
                return (
                  <div key={i} className={`message animate-fade-in ${isSent ? 'sent' : 'received'}`}
                       style={{position:'relative'}}
                       onMouseEnter={() => setHoveredMsgId(msg.id)}
                       onMouseLeave={() => setHoveredMsgId(null)}>
                    {hoveredMsgId === msg.id && (
                      <div className="message-actions" style={{position:'absolute', top:'-15px', right: isSent ? '0' : '-80px', display:'flex', gap:'4px', background:'var(--bg-secondary)', padding:'4px', borderRadius:'12px', border:'1px solid var(--border-color)', zIndex:10}}>
                         <button onClick={() => setReplyingTo(msg)} style={{background:'transparent', color:'var(--text-muted)'}} title="Responder"><Reply size={14}/></button>
                         <button onClick={() => socket.emit('react_message', {msgId: msg.id, emoji: '❤️'})} style={{background:'transparent', cursor:'pointer'}}>❤️</button>
                         <button onClick={() => socket.emit('react_message', {msgId: msg.id, emoji: '👍'})} style={{background:'transparent', cursor:'pointer'}}>👍</button>
                         <button onClick={() => socket.emit('react_message', {msgId: msg.id, emoji: '😂'})} style={{background:'transparent', cursor:'pointer'}}>😂</button>
                      </div>
                    )}
                    {msg.replyTo && (
                      <div style={{fontSize:'0.8rem', opacity: 0.7, paddingLeft:'8px', borderLeft:'2px solid var(--accent-primary)', marginBottom:'8px', background:'rgba(0,0,0,0.2)', padding:'4px 8px', borderRadius:'4px'}}>
                        {(() => {
                            const original = messages.find(m => m.id === msg.replyTo);
                            if (!original) return 'Mensaje original no encontrado';
                            if (original.text) return original.text.substring(0,25) + (original.text.length > 25 ? '...' : '');
                            if (original.image) return '📷 Imagen compartida';
                            if (original.audio) return '🎤 Nota de voz';
                            return 'Mensaje';
                        })()}
                      </div>
                    )}
                    {activeChat.isGroup && !isSent && <div style={{fontSize:'0.75rem', color: 'var(--accent-primary)', marginBottom: '4px'}}><b>{msg.from}</b></div>}
                    {msg.image && <img src={msg.image} className="msg-image" alt="enviado" onClick={()=> window.open(msg.image, '_blank')} />}
                    {msg.audio && <audio src={msg.audio} controls style={{marginTop: '8px', maxWidth: '100%', outline: 'none'}} />}
                    {msg.text && <div>{msg.text}</div>}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                       <div style={{position:'absolute', bottom:'-10px', right: isSent ? '-10px' : 'auto', left: isSent ? 'auto' : '-10px', background:'var(--bg-primary)', padding:'2px 6px', borderRadius:'12px', fontSize:'0.8rem', display:'flex', gap:'2px', border:'1px solid var(--glass-border)'}}>
                         {Object.values(msg.reactions).map((em, idx) => <span key={idx} style={{margin:'0 2px'}}>{em}</span>)}
                       </div>
                    )}
                  </div>
                );
              })}
              
              {typingUsers[activeChat.id] && (
                <div className="typing-bubble">
                  <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area" style={{display:'flex', flexDirection:'column'}}>
              {replyingTo && (
                <div className="reply-preview-bar animate-fade-in" style={{background: 'var(--bg-tertiary)', padding:'8px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTopLeftRadius:'12px', borderTopRightRadius:'12px', borderBottom:'1px solid var(--border-color)', fontSize:'0.85rem'}}>
                  <div>
                    <span style={{color:'var(--accent-primary)', fontWeight:'600', marginRight:'8px'}}><Reply size={14} style={{verticalAlign:'middle'}}/> Respondiendo a:</span>
                    <span style={{opacity:0.8}}>{replyingTo.text ? replyingTo.text.substring(0,30) + (replyingTo.text.length > 30 ? '...' : '') : (replyingTo.image ? '📷 Imagen' : '🎤 Audio')}</span>
                  </div>
                  <X size={16} style={{cursor:'pointer', opacity:0.6}} onClick={() => setReplyingTo(null)}/>
                </div>
              )}
              {imagePreview && (
                <div className="image-preview-bar animate-fade-in">
                  <img src={imagePreview} />
                  <X className="cancel-img" onClick={() => setImagePreview(null)}/>
                </div>
              )}
              
              <form className="chat-input-form" onSubmit={sendMessage}>
                <input type="file" accept="image/*" style={{display:'none'}} ref={fileInputRef} onChange={handleImageUpload}/>
                <button type="button" className="btn-attach" onClick={() => fileInputRef.current?.click()} title="Adjuntar Imagen">
                  <ImageIcon size={20}/>
                </button>
                {isRecording ? (
                   <button type="button" className="btn-attach" style={{color: 'var(--error-color)'}} onClick={stopRecording} title="Detener y Enviar Audio">
                     <Square size={20} fill="currentColor"/>
                   </button>
                ) : (
                   <button type="button" className="btn-attach" onClick={startRecording} title="Grabar Nota de Voz">
                     <Mic size={20}/>
                   </button>
                )}
                <input 
                  type="text"  
                  placeholder="Escribe un mensaje..." 
                  value={inputText}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
                <button type="submit" className="btn-send">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <span><MessageSquare size={64} opacity={0.2}/></span>
            <h2>Tus Mensajes</h2>
            <p>Selecciona un amigo o sala para empezar a chatear.</p>
          </div>
        )}
      </div>
      
      {copied && <div className="copy-toast">ID copiado al portapapeles</div>}

      {activeCall && socket && (
        <VideoCallModal socket={socket} user={user} activeCall={activeCall} onEndCall={() => setActiveCall(null)} />
      )}

      {showProfile && (
        <ProfileModal 
          user={user} 
          token={token} 
          onClose={() => setShowProfile(false)} 
          onUserUpdate={onUserUpdate} 
        />
      )}

      {showGroupInfo && activeChat && activeChat.isGroup && (
        <GroupModal 
          group={activeChat} 
          token={token}
          onClose={() => setShowGroupInfo(false)}
          onGroupUpdate={(g) => setActiveChat(g)}
        />
      )}
    </div>
  );
}
