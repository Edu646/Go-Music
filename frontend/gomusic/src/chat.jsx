import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from './socket'; // Asegúrate de que la ruta sea correcta
import './chat.css'; // Asumo que usas el CSS profesional que te di antes

// Obtener el usuario del almacenamiento local (asumiendo que Formulario.jsx lo guarda)
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
  
  // Estado principal de la vista y mensajes
  const [view, setView] = useState("global"); // 'global' o 'private'
  const [text, setText] = useState("");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({}); // { 'userB': [{msg}, {msg}, ...], 'userC': [...] }
  
  // Estado de usuarios y selección
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allPotentialUsers, setAllPotentialUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // Usuario seleccionado para chat privado
  const [search, setSearch] = useState("");
  
  // Referencia para el scroll automático
  const messagesEndRef = useRef(null);

  // ----------------------------------------------------
  // 1. LÓGICA DE CONEXIÓN Y CARGA INICIAL
  // ----------------------------------------------------

  const fetchInitialData = useCallback(async () => {
    // A. Cargar mensajes globales (REST API)
    try {
      const globalRes = await fetch("/messages");
      const globalData = await globalRes.json();
      setGlobalMessages(globalData);
    } catch (err) {
      console.error("Error cargando mensajes globales:", err);
    }

    // B. Cargar todos los mensajes privados del usuario (REST API)
    try {
      const privateRes = await fetch(`/private-messages?username=${username}`);
      const privateData = await privateRes.json();
      
      // Reorganizar mensajes privados en el formato de estado { [otherUser]: [msgs] }
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
    
    // C. Cargar todos los usuarios potenciales (para el buscador)
    try {
        const userRes = await fetch("/users"); // El nuevo endpoint
        const userData = await userRes.json();
        setAllPotentialUsers(userData);
    } catch (err) {
        console.error("Error cargando usuarios potenciales:", err);
    }

  }, [username]);

  useEffect(() => {
    if (username === "Anónimo") return;

    fetchInitialData();

    // 1. Conectar y notificar que estás online
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("userOnline", username);
    
    // 2. Listener para recibir la lista de usuarios en línea
    socket.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });

    // 3. Listener para mensajes GLOBAL
    socket.on("newMessage", (msg) => {
      setGlobalMessages(prev => [...prev, msg]);
    });

    // 4. Listener para mensajes PRIVADOS
    socket.on("privateMessage", (msg) => {
      // Determina el chat correcto: si soy el sender, el otro es el recipient, y viceversa.
      const otherUser = msg.sender === username ? msg.recipient : msg.sender;
      
      setPrivateChats(prev => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), msg]
      }));
      
      // Lógica de "Marcar como leído" si el chat está abierto
      if (view === 'private' && selectedUser === otherUser && msg.recipient === username) {
        markMessagesAsRead(msg.sender);
      }
    });

    // Cleanup: Desconectar los listeners al desmontar
    return () => {
      socket.off("onlineUsers");
      socket.off("newMessage");
      socket.off("privateMessage");
      // Opcional: socket.disconnect(); si es la última pestaña
    };
  }, [username, fetchInitialData]);

  // Scroll al final al recibir nuevos mensajes
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
      // Actualizar el estado local para reflejar que fueron leídos
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
  // 2. LÓGICA DE ENVÍO DE MENSAJES (FIX DOBLE ENVÍO)
  // ----------------------------------------------------

  const send = () => {
    if (!text.trim() || username === "Anónimo") return;
    
    if (view === "global") {
      // Solo emitimos. El socket.on("newMessage") lo añade.
      socket.emit("sendMessage", { sender: username, text });
      
    } else if (view === "private" && selectedUser) {
      
      // 🚨 FIX DOBLE ENVÍO: SOLO EMITIMOS. 
      // La actualización de 'setPrivateChats' se hace ÚNICAMENTE 
      // en el listener socket.on("privateMessage") (la confirmación del server).
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
  // 3. LÓGICA DE BARRA LATERAL (FIX ENVIAR A SÍ MISMO)
  // ----------------------------------------------------
  
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setView("private");
    
    // Si selecciono un usuario que me envió mensajes, los marco como leídos
    if (privateChats[user]?.some(msg => msg.recipient === username && !msg.read)) {
        markMessagesAsRead(user);
    }
  };

  const combinedUsers = Array.from(new Set([
    ...onlineUsers,
    ...allPotentialUsers,
    ...Object.keys(privateChats) // Incluir usuarios con los que ya chateé
  ]));
  
  // 🚨 FIX ENVIAR A SÍ MISMO: Filtramos el usuario actual de la lista.
  const filteredUsers = combinedUsers.filter(u => u !== username);
  
  // Aplicar el filtro de búsqueda
  const chatPartners = filteredUsers.filter(u => 
    u.toLowerCase().includes(search.toLowerCase())
  );
  
  // Función auxiliar para obtener el estado y el último mensaje
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
  // 4. RENDERING
  // ----------------------------------------------------

  const currentMessages = view === "global" 
    ? globalMessages 
    : privateChats[selectedUser] || [];

  return (
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
            {/* Opcional: Botones de opciones */}
        </div>
        
        <div className="messages-container">
          {currentMessages.length > 0 ? currentMessages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.sender === username ? 'sent' : 'received'}`}>
              <div className="message-bubble">
                {view === 'global' && msg.sender !== username && (
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
            {/* Usar un icono de "enviar" */}
            ➡️
          </button>
        </div>
      </div>
    </div>
  );
}