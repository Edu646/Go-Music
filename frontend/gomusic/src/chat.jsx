import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket'; // Asegúrate de que la ruta sea correcta
import './chat.css'; 

// Función para obtener el usuario del almacenamiento local
const getUsername = () => {
  try {
    const user = JSON.parse(localStorage.getItem("gomusic_user"));
    return user?.username || "Anónimo";
  } catch {
    return "Anónimo";
  }
};

export default function Chat() {
  const username = getUsername();
  
  // Estado principal
  const [view, setView] = useState("global"); 
  const [text, setText] = useState("");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({}); 
  
  // Estados de carga y usuarios
  const [isChatDataLoaded, setIsChatDataLoaded] = useState(false); // 🚩 CONTROL DE CARGA
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allPotentialUsers, setAllPotentialUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [search, setSearch] = useState("");
  
  const messagesEndRef = useRef(null);

  // ----------------------------------------------------
  // 🚨 FIX 4: Bloquear Renderizado si no hay usuario (Seguridad)
  // ----------------------------------------------------
  if (username === "Anónimo") {
    return (
      <div className="chat-container-unlocked" style={{ 
          textAlign: 'center', 
          padding: '50px', 
          backgroundColor: '#282c34', 
          color: 'white', 
          borderRadius: '8px',
          maxWidth: '500px',
          margin: '50px auto'
        }}>
        <h2>🔒 Chat Bloqueado</h2>
        <p>Debes **iniciar sesión** para acceder al chat.</p>
      </div>
    );
  }

  // ----------------------------------------------------
  // 1. LÓGICA DE CARGA DE DATOS (FIX 5: Carga Diferida)
  // ----------------------------------------------------

  const loadChatData = useCallback(async () => {
    if (isChatDataLoaded) return; 

    console.log("Cargando datos de chat...");
    
    // A. Cargar mensajes globales (REST API)
    try {
      const globalRes = await fetch("/messages");
      const globalData = await globalRes.json();
      setGlobalMessages(globalData);
    } catch (err) {
      console.error("Error cargando mensajes globales:", err);
    }

    // B. Cargar mensajes privados y organizar
    try {
      const privateRes = await fetch(`/private-messages?username=${username}`);
      const privateData = await privateRes.json();
      
      const organizedChats = {};
      privateData.forEach(msg => {
        const otherUser = msg.sender === username ? msg.recipient : msg.sender;
        if (!organizedChats[otherUser]) {
          organizedChats[otherUser] = [];
        }
        organizedChats[otherUser].push(msg);
      });
      setPrivateChats(organizedChats);
    } catch (err) {
      console.error("Error cargando mensajes privados:", err);
    }
    
    // C. Cargar todos los usuarios potenciales
    try {
        const userRes = await fetch("/users");
        const userData = await userRes.json();
        setAllPotentialUsers(userData.map(u => u.username)); // Asumiendo que /users devuelve objetos con propiedad username
    } catch (err) {
        console.error("Error cargando usuarios potenciales:", err);
    }

    setIsChatDataLoaded(true); // 👈 Marcamos la carga como finalizada
  }, [username, isChatDataLoaded]);

  // ----------------------------------------------------
  // 2. LISTENERS DE SOCKET (Se activan SÓLO después de cargar datos)
  // ----------------------------------------------------
  useEffect(() => {
    if (isChatDataLoaded) {
      // Conectar y notificar que estás online
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit("userOnline", username);
      
      // Listener para recibir la lista de usuarios en línea
      socket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      // Listener para mensajes GLOBAL
      socket.on("newMessage", (msg) => {
        setGlobalMessages(prev => [...prev, msg]);
      });

      // Listener para mensajes PRIVADOS
      socket.on("privateMessage", (msg) => {
        const otherUser = msg.sender === username ? msg.recipient : msg.sender;
        
        setPrivateChats(prev => ({
          ...prev,
          [otherUser]: [...(prev[otherUser] || []), msg]
        }));
        
        // Marcar como leído
        if (view === 'private' && selectedUser === otherUser && msg.recipient === username) {
          markMessagesAsRead(msg.sender);
        }
      });

      // Cleanup: Desconectar los listeners al desmontar
      return () => {
        socket.off("onlineUsers");
        socket.off("newMessage");
        socket.off("privateMessage");
      };
    }
  }, [username, isChatDataLoaded, selectedUser, view]);

  // Scroll al final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, privateChats, selectedUser]);
  
  // Función para marcar mensajes como leídos
  const markMessagesAsRead = useCallback(async (sender) => {
    try {
      await fetch("/private-messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, sender }),
      });
      setPrivateChats(prev => {
        const updatedMsgs = (prev[sender] || []).map(msg => 
          msg.recipient === username ? { ...msg, read: true } : msg
        );
        return { ...prev, [sender]: updatedMsgs };
      });
      
    } catch (err) {
      console.error("Error marcando mensajes como leídos:", err);
    }
  }, [username]);

  // ----------------------------------------------------
  // 3. LÓGICA DE ENVÍO DE MENSAJES (FIX 1: No Duplicación)
  // ----------------------------------------------------

  const send = () => {
    if (!text.trim()) return;
    
    if (view === "global") {
      socket.emit("sendMessage", { sender: username, text });
      
    } else if (view === "private" && selectedUser) {
      // 🚨 FIX 1: Solo emitimos. Dependemos de socket.on('privateMessage') para la actualización.
      socket.emit("sendPrivateMessage", { sender: username, recipient: selectedUser, text });
    }
    
    setText("");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      send();
    }
  };

  // ----------------------------------------------------
  // 4. LÓGICA DE BARRA LATERAL (FIX 3: No enviar a sí mismo)
  // ----------------------------------------------------
  
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setView("private");
    
    if (privateChats[user]?.some(msg => msg.recipient === username && !msg.read)) {
        markMessagesAsRead(user);
    }
  };

  const combinedUsers = Array.from(new Set([
    ...onlineUsers,
    ...allPotentialUsers,
    ...Object.keys(privateChats) 
  ]));
  
  // 🚨 FIX 3: Filtramos al usuario actual de la lista de contactos
  const filteredUsers = combinedUsers.filter(u => u !== username);
  
  const chatPartners = filteredUsers.filter(u => 
    u.toLowerCase().includes(search.toLowerCase())
  );
  
  const getUserChatDetails = (user) => {
    const isOnline = onlineUsers.includes(user);
    const msgs = privateChats[user] || [];
    const lastMsg = msgs[msgs.length - 1];
    const unreadCount = msgs.filter(msg => msg.recipient === username && !msg.read).length;
    
    return {
      isOnline,
      lastMsgText: lastMsg ? (lastMsg.sender === username ? 'Tú: ' : '') + lastMsg.text : 'Iniciar chat...',
      unreadCount
    };
  };

  // ----------------------------------------------------
  // 5. RENDERING FINAL (Mostrar bloqueo/chat)
  // ----------------------------------------------------

  const currentMessages = view === "global" 
    ? globalMessages 
    : privateChats[selectedUser] || [];

  return (
    // 🚨 Renderizado condicional basado en isChatDataLoaded
    !isChatDataLoaded ? (
        <div className="chat-blocker" style={{ textAlign: 'center', padding: '50px', margin: '50px auto', maxWidth: '400px', backgroundColor: '#333', borderRadius: '8px', color: 'white' }}>
            <h2>Cargar Mensajes</h2>
            <p>El chat está listo, pero la carga de mensajes está suspendida.</p>
            <button 
                onClick={loadChatData} 
                style={{ 
                    padding: '10px 20px', 
                    fontSize: '16px', 
                    cursor: 'pointer', 
                    backgroundColor: '#1E90FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    marginTop: '15px'
                }}
            >
                Abrir y Cargar Chats Ahora
            </button>
        </div>
    ) : (
      <div className="chat-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>Chats ({username})</h3>
            <button 
              className={`global-chat-btn ${view === 'global' ? 'active' : ''}`}
              onClick={() => { setView('global'); setSelectedUser(null); }}
            >
              Chat Global {onlineUsers.length > 0 && `(${onlineUsers.length} en línea)`}
            </button>
            
            <input 
              type="text" 
              placeholder="Buscar usuario..." 
              className="search-user-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="users-list">
              <h4 className="list-title">Contactos:</h4>
              {chatPartners.length > 0 ? chatPartners.map(user => {
                  const details = getUserChatDetails(user);
                  
                  return (
                      <div 
                        key={user} 
                        className={`user-item ${selectedUser === user ? 'selected' : ''}`}
                        onClick={() => handleUserSelect(user)}
                      >
                          <div className={`avatar-placeholder ${details.isOnline ? 'online' : ''}`}>
                              {user[0].toUpperCase()}
                          </div>
                          <div className="user-details">
                              <span className="username">{user}</span>
                              <span className="status-text">{details.lastMsgText}</span>
                          </div>
                          {details.unreadCount > 0 && (
                              <div className="unread-count">{details.unreadCount}</div>
                          )}
                      </div>
                  );
              }) : <p style={{ padding: '10px', fontSize: '14px', color: '#667781' }}>No hay usuarios para mostrar.</p>}
          </div>
        </div>
        
        {/* Área de Mensajes */}
        <div className="chat-area">
          <div className="chat-header">
              <div className="header-info">
                  {view === 'global' ? (
                      <h2>Chat Global</h2>
                  ) : (
                      <>
                          <h2>{selectedUser}</h2>
                          <span className={`status-indicator ${getUserChatDetails(selectedUser).isOnline ? 'on' : ''}`}>
                              {getUserChatDetails(selectedUser).isOnline ? 'En línea' : 'Desconectado'}
                          </span>
                      </>
                  )}
              </div>
          </div>
          
          <div className="messages-container">
            {currentMessages.length > 0 ? currentMessages.map((msg, index) => (
              <div key={index} className={`message-wrapper ${msg.sender === username ? 'sent' : 'received'}`}>
                <div className="message-bubble">
                  
                  {/* 🚨 FIX 6: Muestra el nombre del remitente si NO eres TÚ (el caso 'papa' a 'evaleromolina') */}
                  {msg.sender !== username && (
                      <div className="message-sender">{msg.sender}</div>
                  )}
                  
                  {msg.text}
                  <span className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )) : (
              <p style={{ textAlign: 'center', color: '#667781', margin: 'auto' }}>
                  {view === 'global' ? 'Sé el primero en saludar!' : `Es el inicio de tu chat con ${selectedUser}.`}
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Área de Input */}
          <div className="input-area">
            <input 
              type="text"
              placeholder={view === 'global' ? "Escribe un mensaje global..." : `Escribe un mensaje a ${selectedUser}...`}
              className="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={view === 'private' && !selectedUser}
            />
            <button onClick={send} className="send-btn" disabled={view === 'private' && !selectedUser}>
              ➡️
            </button>
          </div>
        </div>
      </div>
    )
  );
}