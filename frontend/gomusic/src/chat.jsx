import React, { useState, useEffect, useCallback, useRef } from 'react';

// Simulación de socket para demo (reemplazar con tu socket real)
const socket = {
  connected: false,
  connect: () => { socket.connected = true; },
  emit: (event, data) => console.log('Socket emit:', event, data),
  on: (event, callback) => console.log('Socket listening:', event),
  off: (event) => console.log('Socket off:', event)
};

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
  
  // 📱 NUEVO: Estado para controlar sidebar en móvil
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
  
  useEffect(() => {
    if (isChatDataLoaded) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit("userOnline", username);
      
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
        
        if (view === 'private' && selectedUser === otherUser && msg.recipient === username) {
          markMessagesAsRead(msg.sender);
        }
      });

      return () => {
        socket.off("onlineUsers");
        socket.off("newMessage");
        socket.off("privateMessage");
      };
    }
  }, [username, isChatDataLoaded, selectedUser, view, markMessagesAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, privateChats, selectedUser]);
  
  const send = () => {
    if (!text.trim()) return;
    
    if (view === "global") {
      socket.emit("sendMessage", { sender: username, text });
    } else if (view === "private" && selectedUser) {
      socket.emit("sendPrivateMessage", { sender: username, recipient: selectedUser, text });
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
    setSidebarOpen(false); // 📱 Cerrar sidebar al seleccionar usuario
    
    if (privateChats[user]?.some(msg => msg.recipient === username && !msg.read)) {
      markMessagesAsRead(user);
    }
  };

  // Bloqueo de sesión
  if (username === "Anónimo") {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '50px', 
        backgroundColor: '#282c34', 
        color: 'white', 
        borderRadius: '8px',
        maxWidth: '500px',
        margin: '50px auto'
      }}>
        <h2>🔒 Chat Bloqueado</h2>
        <p>Debes iniciar sesión para acceder al chat.</p>
      </div>
    );
  }

  // Filtrado de usuarios
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
    <div style={{ 
      textAlign: 'center', 
      padding: '50px', 
      margin: '50px auto', 
      maxWidth: '400px', 
      backgroundColor: '#333', 
      borderRadius: '8px', 
      color: 'white' 
    }}>
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
    <>
      <style>{`
        :root {
          --primary: #007bff;
          --primary-dark: #0056b3;
          --primary-light: #e6f7ff;
          --secondary: #f7f9fc;
          --chat-bg: #f0f2f5;
          --sent-bubble: #dcf8c6;
          --received-bubble: #ffffff;
          --header: #1a1a1a;
          --success: #4caf50;
          --text-primary: #1a1a1a;
          --text-secondary: #777;
          --border: #e0e0e0;
        }

        .chat-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          margin: 0;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: var(--secondary);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .sidebar {
          width: 380px;
          min-width: 380px;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .sidebar-overlay {
          display: none;
        }

        .sidebar-header {
          padding: 24px 20px 12px;
          border-bottom: 1px solid #f5f5f5;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #ffffff;
          flex-shrink: 0;
        }

        .sidebar-header h3 {
          margin: 0;
          font-size: 26px;
          background: linear-gradient(135deg, var(--primary) 0%, #0056b3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .global-chat-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px;
          margin-bottom: 8px;
          border: none;
          border-radius: 12px;
          background: var(--primary-light);
          color: var(--primary);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          gap: 10px;
        }

        .global-chat-btn:hover {
          background: #cce6ff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
        }

        .global-chat-btn.active {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          box-shadow: 0 6px 16px rgba(0, 123, 255, 0.3);
        }

        .search-user-input {
          width: 100%;
          padding: 12px 18px;
          border-radius: 12px;
          border: 2px solid transparent;
          background: var(--secondary);
          font-size: 15px;
          outline: none;
          transition: all 0.3s ease;
        }

        .search-user-input:focus {
          border-color: var(--primary);
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1);
        }

        .users-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .list-title {
          padding: 12px 20px 8px;
          font-size: 12px;
          color: #888;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .user-item {
          display: flex;
          align-items: center;
          padding: 14px 20px;
          transition: all 0.3s ease;
          cursor: pointer;
          gap: 14px;
          position: relative;
          margin: 0 8px;
          border-radius: 12px;
        }

        .user-item.selected {
          background: linear-gradient(90deg, var(--primary-light) 0%, rgba(230, 247, 255, 0.5) 100%);
        }

        .user-item:not(.selected):hover {
          background: #f9f9f9;
          transform: translateX(4px);
        }

        .avatar-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 19px;
          position: relative;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .avatar-placeholder.online::after {
          content: "";
          width: 14px;
          height: 14px;
          background: var(--success);
          border-radius: 50%;
          position: absolute;
          bottom: 0;
          right: 0;
          border: 3px solid #ffffff;
          box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
        }

        .user-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }

        .username {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 16px;
        }

        .status-text {
          font-size: 13px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .unread-count {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 20px;
          min-width: 28px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--chat-bg);
          min-width: 0;
        }

        .chat-header {
          padding: 20px 24px;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 19px;
          font-weight: 700;
          border-bottom: 1px solid var(--border);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
        }

        .back-btn {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.3s ease;
          width: 40px;
          height: 40px;
        }

        .back-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .header-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .header-info h2 {
          margin: 0;
          font-size: 19px;
        }

        .status-indicator {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-indicator.on {
          color: var(--success);
        }

        .messages-container {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-wrapper {
          display: flex;
        }

        .message-wrapper.sent {
          justify-content: flex-end;
        }

        .message-wrapper.received {
          justify-content: flex-start;
        }

        .message-bubble {
          max-width: 65%;
          padding: 14px 20px 28px 20px;
          border-radius: 20px;
          position: relative;
          font-size: 15px;
          line-height: 1.5;
          word-wrap: break-word;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .message-wrapper.sent .message-bubble {
          background: linear-gradient(135deg, var(--sent-bubble) 0%, #c8f0b8 100%);
          border-bottom-right-radius: 6px;
        }

        .message-wrapper.received .message-bubble {
          background: var(--received-bubble);
          border-bottom-left-radius: 6px;
          border: 1px solid #f0f0f0;
        }

        .message-sender {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 6px;
          background: linear-gradient(135deg, var(--primary) 0%, #667eea 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .message-time {
          font-size: 11px;
          color: #888;
          position: absolute;
          bottom: 6px;
          right: 12px;
          opacity: 0.8;
        }

        .input-area {
          display: flex;
          padding: 16px 20px;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
          border-top: 1px solid var(--border);
          gap: 12px;
          align-items: center;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
        }

        .chat-input {
          flex: 1;
          padding: 14px 22px;
          border-radius: 28px;
          border: 2px solid transparent;
          outline: none;
          font-size: 15px;
          background: var(--secondary);
          transition: all 0.3s ease;
        }

        .chat-input:focus {
          border-color: var(--primary);
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1);
        }

        .send-btn {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
        }

        .send-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 123, 255, 0.5);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* RESPONSIVE MÓVIL */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            z-index: 1000;
            background: #ffffff;
            border-right: none;
            transition: left 0.3s ease;
          }

          .sidebar.mobile-open {
            left: 0;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }

          .sidebar-overlay.active {
            opacity: 1;
            pointer-events: auto;
          }

          .chat-area {
            width: 100%;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }

          .back-btn {
            display: flex;
          }

          .message-bubble {
            max-width: 85%;
            font-size: 14px;
            padding: 12px 16px 24px 16px;
          }

          .messages-container {
            padding: 16px;
          }

          .chat-input {
            padding: 12px 18px;
            font-size: 15px;
          }

          .send-btn {
            width: 44px;
            height: 44px;
            font-size: 18px;
          }
        }
      `}</style>

      <div className="chat-container">
        {/* 📱 Overlay para cerrar sidebar */}
        <div 
          className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar con clase condicional */}
        <div className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-header">
            <h3>Chats ({username})</h3>
            <button 
              className={`global-chat-btn ${view === 'global' ? 'active' : ''}`}
              onClick={() => { 
                setView('global'); 
                setSelectedUser(null);
                setSidebarOpen(false); // Cerrar sidebar al seleccionar global
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
              <p style={{ padding: '10px', fontSize: '14px', color: '#667781' }}>
                No hay usuarios para mostrar.
              </p>
            )}
          </div>
        </div>
        
        {/* Área de mensajes */}
        <div className="chat-area">
          <div className="chat-header">
            {/* 📱 Botón volver (solo visible en móvil) */}
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
          
          {/* Área de input */}
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
    </>
  );
}