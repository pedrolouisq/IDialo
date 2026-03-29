import { useEffect, useRef, useState } from 'react';
import { PhoneOff, PhoneCall, Monitor } from 'lucide-react';

export default function VideoCallModal({ socket, user, activeCall, onEndCall }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const isMounted = useRef(true);
  const [callState, setCallState] = useState(activeCall.isIncoming ? 'incoming' : 'calling');
  const [remoteStream, setRemoteStream] = useState(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const iceCandidatesQueue = useRef([]);

  const servers = {
    iceServers: [
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  useEffect(() => {
    if (callState === 'connected' && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [callState, remoteStream]);

  useEffect(() => {
    isMounted.current = true;
    // Escuchar eventos P2P
    const handleAnswer = async ({ from, answer }) => {
      if (from !== activeCall.targetId || !peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState('connected');
        
        // Procesar candidatos en cola
        if (iceCandidatesQueue.current.length > 0) {
          processQueuedCandidates(peerConnectionRef.current);
        }
      } catch (err) {
        console.error("Error processing answer", err);
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      if (from !== activeCall.targetId) return;
      
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      } else {
        iceCandidatesQueue.current.push(candidate);
      }
    };

    const handleCallEnd = ({ from }) => {
      if (from === activeCall.targetId) cleanupAndEnd();
    };

    socket.on('call_answer', handleAnswer);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_end', handleCallEnd);

    return () => {
      isMounted.current = false;
      socket.off('call_answer', handleAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_end', handleCallEnd);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      iceCandidatesQueue.current = [];
    };
  }, [socket, activeCall]);

  const processQueuedCandidates = async (pc) => {
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding queued ice candidate", e);
      }
    }
  };

  const hasStarted = useRef(false);
  // Si soy el que llama (no incoming)
  useEffect(() => {
    if (!activeCall.isIncoming && !hasStarted.current) {
      hasStarted.current = true;
      startCall();
    }
  }, []);

  const initWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      // Evitar flujos fantasmas en desmontajes rápidos de StrictMode
      if (!isMounted.current) {
        stream.getTracks().forEach(t => t.stop());
        return null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(servers);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', { to: activeCall.targetId, candidate: event.candidate });
        }
      };

      return pc;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      alert("No se pudo acceder a la cámara o micrófono.");
      cleanupAndEnd();
      return null;
    }
  };

  const startCall = async () => {
    const pc = await initWebRTC();
    if (!pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('call_offer', { to: activeCall.targetId, offer });
  };

  const acceptCall = async () => {
    const pc = await initWebRTC();
    if (!pc) return;
    
    setCallState('connected');
    await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
    
    // Procesar cualquier candidato que llegó mientras esperábamos que el usuario aceptara
    if (iceCandidatesQueue.current.length > 0) {
      processQueuedCandidates(pc);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('call_answer', { to: activeCall.targetId, answer });
  };

  const cleanupAndEnd = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    socket.emit('call_end', { to: activeCall.targetId });
    onEndCall();
  };

  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;
    try {
      if (!isSharingScreen) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([screenTrack]);
        setIsSharingScreen(true);
        
        screenTrack.onended = async () => {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          const camTrack = camStream.getVideoTracks()[0];
          if (sender) await sender.replaceTrack(camTrack);
          if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
          setIsSharingScreen(false);
        };
      } else {
         const sender = peerConnectionRef.current.getSenders().find(s => s.track.kind === 'video');
         const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
         const camTrack = camStream.getVideoTracks()[0];
         if (sender) await sender.replaceTrack(camTrack);
         if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
         setIsSharingScreen(false);
      }
    } catch (err) {
      console.error("No se pudo compartir pantalla", err);
    }
  };

  return (
    <div className="video-modal-overlay">
      <div className="video-modal">
        <h2>{callState === 'incoming' ? 'Llamada Entrante...' : callState === 'calling' ? 'Llamando...' : 'Llamada en Curso'}</h2>
        <div className="video-container">
          <video ref={localVideoRef} autoPlay playsInline muted className="video-box" style={{transform: 'scaleX(-1)'}}/>
          {callState === 'connected' && (
            <video ref={remoteVideoRef} autoPlay playsInline className="video-box" />
          )}
        </div>
        <div className="video-controls">
          {callState === 'incoming' && (
            <button className="btn-ans" onClick={acceptCall}>
              <PhoneCall size={20} /> Responder
            </button>
          )}
          {callState === 'connected' && (
             <button className="btn-primary" onClick={toggleScreenShare} style={{borderRadius:'30px', padding:'12px 24px'}}>
               <Monitor size={20} /> {isSharingScreen ? 'Detener Pantalla' : 'Compartir Pantalla'}
             </button>
          )}
          <button className="btn-hangup" onClick={cleanupAndEnd}>
             <PhoneOff size={20} /> {callState === 'incoming' ? 'Rechazar' : 'Colgar'}
          </button>
        </div>
      </div>
    </div>
  );
}
