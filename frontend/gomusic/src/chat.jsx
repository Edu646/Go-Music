import React, { useState, useEffect, useCallback, useRef } from 'react';
import './chat.css'; // Asegúrate de tener este archivo o borrar esta línea si no lo usas

// -------------------------------------------------------------------------
// NOTA: Para producción, comenta este mock y usa: import io from 'socket.io-client';
// const socket = io('http://tu-backend-url.com');
// -------------------------------------------------------------------------
 const socket = io('https://go-music-3mgo.onrender.com');

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
  
  // Estados principales
  const [view, setView] = useState("global"); 
  const [text, setText] = useState("");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({}); 
  const [isChatDataLoaded, setIsChatDataLoaded] = useState(false); 
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allPotentialUsers, setAllPotentialUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [search, setSearch] = useState("");
  
  // Estado para controlar sidebar en móvil
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);

  const loadChatData = useCallback(async () => {
    if (isChatDataLoaded) return;

    try {
      const globalRes = await fetch("/messages");
      const globalData = await globalRes.json();
      setGlobalMessages(globalData);
    } catch (err) {
      console.error("Error cargando mensajes globales:", err);
    }

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
    
    try {
      const userRes = await fetch("/users");
      const userData = await userRes.json();
      
      const safeUsernames = userData
        .map(u => u.username)
        .filter(u => u && typeof u === 'string'); 
        
      setAllPotentialUsers(safeUsernames);
    } catch (err) {
      console.error("Error cargando usuarios potenciales:", err);
    }

    setIsChatDataLoaded(true); 
  }, [username, isChatDataLoaded]);

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
  
  // -----------------------------------------------------------------------
  // CORRECCIÓN PRINCIPAL AQUÍ:
  // Eliminadas las dependencias 'view', 'selectedUser' y 'markMessagesAsRead'
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isChatDataLoaded) {
      if (!socket.connected) {
        socket.connect();
      }
      
      // Emitimos que estamos online
      socket.emit("userOnline", username);
      
      // Listeners
      socket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      socket.on("newMessage", (msg) => {
        setGlobalMessages(prev => [...prev, msg]);
      });

      socket.on("privateMessage", (msg) => {
        const otherUser = msg.sender === username ? msg.recipient : msg.sender;
        
        setPrivateChats(prev => ({
          ...prev,
          [otherUser]: [...(prev[otherUser] || []), msg]
        }));
        
        // Nota: Dentro del socket.on no tenemos acceso al estado actualizado de 'view'
        // por el closure de useEffect. Si necesitas marcar como leído al recibir,
        // es mejor hacerlo en un useEffect separado que escuche cambios en privateChats.
      });

      return () => {
        socket.off("onlineUsers");
        socket.off("newMessage");
        socket.off("privateMessage");
      };
    }
  }, [username, isChatDataLoaded]); // Array de dependencias limpio

  // Efecto separado para marcar como leído cuando cambian los chats
  useEffect(() => {
    if (view === 'private' && selectedUser) {
        const chats = privateChats[selectedUser];
        if (chats && chats.some(msg => msg.recipient === username && !msg.read)) {
            markMessagesAsRead(selectedUser);
        }
    }
  }, [privateChats, view, selectedUser, markMessagesAsRead, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, privateChats, selectedUser]);
  
  const send = () => {
    if (!text.trim()) return;
    
    const messageData = {
        text: text,
        sender: username,
        createdAt: new Date().toISOString() // Añadir fecha local para que se vea bien
    };

    if (view === "global") {
      socket.emit("sendMessage", messageData);
      // Opcional: Agregar localmente si el servidor no hace echo
      // setGlobalMessages(prev => [...prev, messageData]); 
    } else if (view === "private" && selectedUser) {
      const privateMsgData = { ...messageData, recipient: selectedUser };
      
      // 1. Emitir al servidor
      socket.emit("sendPrivateMessage", privateMsgData);

      // 2. AGREGAR LOCALMENTE INMEDIATAMENTE (Solución a "no se muestran")
      setPrivateChats(prev => ({
        ...prev,
        [selectedUser]: [...(prev[selectedUser] || []), privateMsgData]
      }));
    }
    
    setText("");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      send();
    }
  };
  
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setView("private");
    setSidebarOpen(false);
    
    if (privateChats[user]?.some(msg => msg.recipient === username && !msg.read)) {
      markMessagesAsRead(user);
    }
  };

  if (username === "Anónimo") {
    return (
      <div className="login-warning">
        <h2>🔒 Chat Bloqueado</h2>
        <p>Debes iniciar sesión para acceder al chat.</p>
      </div>
    );
  }

  const combinedUsers = Array.from(new Set([
    ...onlineUsers,
    ...allPotentialUsers,
    ...Object.keys(privateChats) 
  ]));
  
  const filteredUsers = combinedUsers.filter(u => u && u !== username); 
  
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
  
  const currentMessages = view === "global" 
    ? globalMessages 
    : privateChats[selectedUser] || [];

  return !isChatDataLoaded ? (
    <div className="loading-container">
      <h2>Cargar Mensajes</h2>
      <p>El chat está listo, pero la carga de mensajes está suspendida.</p>
      <button onClick={loadChatData} className="load-btn">
        Abrir y Cargar Chats Ahora
      </button>
    </div>
  ) : (
    <div className="chat-container">
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Chats ({username})</h3>
          <button 
            className={`global-chat-btn ${view === 'global' ? 'active' : ''}`}
            onClick={() => { 
              setView('global'); 
              setSelectedUser(null);
              setSidebarOpen(false);
            }}
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
          }) : (
            <p className="no-users">No hay usuarios para mostrar.</p>
          )}
        </div>
      </div>
      
      <div className="chat-area">
        <div className="chat-header">
          <button 
            className="back-btn" 
            onClick={() => setSidebarOpen(true)}
          >
            ←
          </button>
          
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
                {msg.sender !== username && (
                  <div className="message-sender">
                    {msg.sender}
                  </div>
                )}
                
                {msg.text}
                <span className="message-time">
                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )) : (
            <p className="empty-chat-msg">
              {view === 'global' ? 'Sé el primero en saludar!' : `Es el inicio de tu chat con ${selectedUser}.`}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>
        
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
          <button 
            onClick={send} 
            className="send-btn" 
            disabled={view === 'private' && !selectedUser}
          >
            ➡️
          </button>
        </div>
      </div>
    </div>
  );
}