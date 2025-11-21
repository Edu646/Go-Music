import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "./socket";
import { getCurrentUser } from "./auth";
import "./chat.css"; 

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [newCount, setNewCount] = useState(0);
  
  // Estados para usuarios
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Lista completa de la BD
  const [searchTerm, setSearchTerm] = useState(""); // Texto del buscador

  const [selectedUser, setSelectedUser] = useState(null);
  const [privateChats, setPrivateChats] = useState({});
  const [unreadPrivate, setUnreadPrivate] = useState({});
  const [view, setView] = useState("global"); 
  
  const username = getCurrentUser();

  // --- EFECTOS ---

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!username) {
      navigate("/SESION");
      return;
    }

    // 1. Cargar TODOS los usuarios registrados (para poder buscarlos)
    fetch("/users")
      .then(res => res.json())
      .then(data => {
        // Aseguramos que sea un array de strings (nombres)
        const userList = data.map(u => (typeof u === 'object' ? u.username : u));
        setAllUsers(userList.filter(u => u !== username));
      })
      .catch(() => console.log("No se pudo cargar la lista global de usuarios"));

    // 2. Cargar mensajes globales
    fetch("/messages")
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error(err));

    // 3. Cargar historial de chats privados
    fetch(`/private-messages?username=${username}`)
      .then(res => res.json())
      .then(data => {
        const chats = {};
        const unread = {};
        data.forEach(msg => {
          const otherUser = msg.sender === username ? msg.recipient : msg.sender;
          if (!chats[otherUser]) chats[otherUser] = [];
          chats[otherUser].push(msg);
          if (msg.recipient === username && !msg.read) {
            unread[msg.sender] = (unread[msg.sender] || 0) + 1;
          }
        });
        setPrivateChats(chats);
        setUnreadPrivate(unread);
      })
      .catch(err => console.error(err));

    // Socket
    socket.emit("userOnline", username);

    socket.on("onlineUsers", users => {
      setOnlineUsers(users.filter(u => u !== username));
    });

    socket.on("newMessage", msg => {
      setMessages(prev => [...prev, msg]);
      if (document.hidden || view !== "global") {
        setNewCount(prev => prev + 1);
        showNotification("Chat Global", `${msg.sender}: ${msg.text}`);
      }
    });

    socket.on("privateMessage", msg => {
      const otherUser = msg.sender === username ? msg.recipient : msg.sender;
      setPrivateChats(prev => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), msg]
      }));
      
      // Si me habla alguien nuevo, asegurarnos de tenerlo en la lista
      setAllUsers(prev => {
        if (!prev.includes(otherUser)) return [...prev, otherUser];
        return prev;
      });

      if (msg.recipient === username && (selectedUser !== msg.sender || view !== "private" || document.hidden)) {
        setUnreadPrivate(prev => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1
        }));
        showNotification(`Mensaje de ${msg.sender}`, msg.text);
      }
    });

    return () => {
      socket.off("newMessage");
      socket.off("privateMessage");
      socket.off("onlineUsers");
    };
  }, [username, navigate, selectedUser, view]);

  // ... Helpers (showNotification, markAsRead, send, openPrivateChat) ...
  // (Los pongo resumidos para ahorrar espacio, son iguales que antes)
  const showNotification = (title, body) => { /* igual que antes */ };
  
  const markAsRead = (sender) => {
    setUnreadPrivate(prev => ({ ...prev, [sender]: 0 }));
    fetch("/private-messages/mark-read", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, sender })
    }).catch(err => console.error(err));
  };

  const send = () => {
    if (!text.trim()) return;
    if (view === "global") {
      socket.emit("sendMessage", { sender: username, text });
    } else if (view === "private" && selectedUser) {
      const newMsg = { sender: username, recipient: selectedUser, text, createdAt: new Date() };
      setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), newMsg] }));
      socket.emit("sendPrivateMessage", { sender: username, recipient: selectedUser, text });
    }
    setText("");
  };

  const openPrivateChat = (user) => {
    setSelectedUser(user);
    setView("private");
    markAsRead(user);
    // Nota: No borramos el searchTerm para que el usuario siga viendo la lista filtrada si quiere
  };

  // --- LÓGICA DE FILTRADO (LA CLAVE) ---
  let usersToDisplay = [];

  if (searchTerm.trim() === "") {
    // 1. MODO "MIS CHATS": Si no busca nada, mostramos historial + conectados
    const historyUsers = Object.keys(privateChats);
    usersToDisplay = Array.from(new Set([...onlineUsers, ...historyUsers]));
  } else {
    // 2. MODO "BÚSQUEDA": Si escribe, buscamos en TODOS los usuarios (allUsers)
    usersToDisplay = allUsers.filter(u => 
      u.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Ordenar: Conectados arriba, luego alfabético
  usersToDisplay.sort((a, b) => {
    const aOnline = onlineUsers.includes(a);
    const bOnline = onlineUsers.includes(b);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.localeCompare(b);
  });

  const currentMessages = view === "global" ? messages : (privateChats[selectedUser] || []);

  if (!username) return null;

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>💬 Chats</h3>
          <button 
            className={`global-chat-btn ${view === "global" ? "active" : ""}`}
            onClick={() => setView("global")}
          >
            <span>🌐 Sala Global</span>
            {newCount > 0 && <span className="badge">{newCount}</span>}
          </button>

          <input 
            type="text"
            placeholder="🔍 Buscar persona..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-user-input"
          />
        </div>

        <div className="users-list">
          <div className="list-title">
             {searchTerm ? "Resultados de búsqueda" : "Mis conversaciones"}
          </div>

          {usersToDisplay.length === 0 && (
             <div className="no-users">
                {searchTerm ? "No se encontró nadie con ese nombre" : "No tienes chats activos"}
             </div>
          )}
          
          {usersToDisplay.map(user => {
             const isOnline = onlineUsers.includes(user);
             const isSelected = selectedUser === user && view === "private";
             return (
              <div
                key={user}
                className={`user-item ${isSelected ? "selected" : ""}`}
                onClick={() => openPrivateChat(user)}
              >
                <div className="user-info">
                  <div className={`avatar-placeholder ${isOnline ? "online" : ""}`}>
                    {user.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <span className="username">{user}</span>
                    <span className="status-text">{isOnline ? "En línea" : "Offline"}</span>
                  </div>
                </div>
                
                {unreadPrivate[user] > 0 && (
                  <span className="badge private-badge">{unreadPrivate[user]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        <div className="chat-header">
          <div className="header-info">
            <h2>{view === "global" ? "🌐 Chat Global" : selectedUser}</h2>
            {view === "private" && (
               <span className={`status-indicator ${onlineUsers.includes(selectedUser) ? "on" : "off"}`}>
                 {onlineUsers.includes(selectedUser) ? "• En línea" : "• Desconectado"}
               </span>
            )}
          </div>
        </div>

        <div className="messages-container">
          {currentMessages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👋</div>
              <p>{view === "global" ? "¡Saluda a todos!" : `Escribe tu primer mensaje a ${selectedUser}`}</p>
            </div>
          )}
          
          {currentMessages.map((m, i) => {
            const isMe = m.sender === username;
            return (
              <div key={i} className={`message-wrapper ${isMe ? "sent" : "received"}`}>
                <div className="message-bubble">
                  {!isMe && view === "global" && <div className="message-sender">{m.sender}</div>}
                  <div className="message-text">{m.text}</div>
                  <div className="message-time">
                    {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="input-area">
          <input
            className="chat-input"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyPress={e => e.key === "Enter" && send()}
            placeholder="Escribe un mensaje..."
          />
          <button className="send-btn" onClick={send} disabled={!text.trim()}>
            ➢
          </button>
        </div>
      </div>
    </div>
  );
}