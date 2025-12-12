import React, { useState, useEffect, useCallback, useRef } from 'react';
import './chat.css';
import io from 'socket.io-client';

const socket = io('https://go-music-3mgo.onrender.com', { autoConnect: false });

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👏', '🎉', '❤️', '🔥', '✨', '🎵', '🎸', '🎤', '🎧'];

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

  const [view, setView] = useState("global");
  const [text, setText] = useState("");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({});
  const [isChatDataLoaded, setIsChatDataLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allPotentialUsers, setAllPotentialUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sentMessageIds, setSentMessageIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
        if (!organizedChats[otherUser]) organizedChats[otherUser] = [];
        organizedChats[otherUser].push(msg);
      });
      setPrivateChats(organizedChats);
    } catch (err) {
      console.error("Error cargando mensajes privados:", err);
    }

    try {
      const userRes = await fetch("/users");
      const userData = await userRes.json();
      setAllPotentialUsers(userData.filter(u => u && typeof u === 'string' && u !== "Anónimo"));
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
    loadChatData();
  }, [loadChatData]);

  useEffect(() => {
    if (!socket.connected && isChatDataLoaded) socket.connect();

    const handleConnect = () => {
      socket.emit("userOnline", username);
    };

    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();

    socket.on("onlineUsers", setOnlineUsers);

    socket.on("newMessage", msg => {
      const msgId = `${msg.sender}-${msg.createdAt}-${msg.text}`;
      if (!sentMessageIds.has(msgId)) setGlobalMessages(prev => [...prev, msg]);
    });

    socket.on("privateMessage", msg => {
      const msgId = `${msg.sender}-${msg.recipient}-${msg.createdAt}-${msg.text}`;
      if (msg.sender === username && sentMessageIds.has(msgId)) return;

      const otherUser = msg.sender === username ? msg.recipient : msg.sender;
      setPrivateChats(prev => {
        const existingMsgs = prev[otherUser] || [];
        if (existingMsgs.some(m => m.sender === msg.sender && m.text === msg.text && m.createdAt === msg.createdAt)) return prev;
        return { ...prev, [otherUser]: [...existingMsgs, msg] };
      });
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off("onlineUsers");
      socket.off("newMessage");
      socket.off("privateMessage");
      socket.disconnect();
    };
  }, [username, isChatDataLoaded, sentMessageIds]);

  useEffect(() => {
    if (view === 'private' && selectedUser) {
      const chats = privateChats[selectedUser];
      if (chats?.some(msg => msg.recipient === username && !msg.read)) {
        markMessagesAsRead(selectedUser);
      }
    }
  }, [privateChats, view, selectedUser, markMessagesAsRead, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, privateChats, selectedUser]);

  const handleFileSelect = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("Archivo máximo 5MB.");

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    } else setPreviewUrl(null);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const send = async () => {
    if (!text.trim() && !selectedFile) return;

    const messageId = `${username}-${Date.now()}-${text || 'file'}-${Math.random()}`;
    const timestamp = new Date().toISOString();
    let fileData = null;

    if (selectedFile) {
      const reader = new FileReader();
      fileData = await new Promise(resolve => {
        reader.onloadend = () => resolve({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          data: reader.result
        });
        reader.readAsDataURL(selectedFile);
      });
    }

    const messageData = { text, sender: username, createdAt: timestamp, file: fileData, messageId };
    setSentMessageIds(prev => new Set(prev).add(messageId));

    if (view === "global") {
      socket.emit("sendMessage", messageData);
      setGlobalMessages(prev => [...prev, messageData]);
    } else if (view === "private" && selectedUser) {
      const privateMsgData = { ...messageData, recipient: selectedUser };
      socket.emit("sendPrivateMessage", privateMsgData);
      setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), privateMsgData] }));
    }

    setText("");
    removeFile();
    setShowEmojiPicker(false);
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const addEmoji = emoji => { setText(prev => prev + emoji); setShowEmojiPicker(false); };

  const handleUserSelect = user => {
    setSelectedUser(user);
    setView("private");
    setSidebarOpen(false);
    if (privateChats[user]?.some(msg => msg.recipient === username && !msg.read)) markMessagesAsRead(user);
  };

  if (username === "Anónimo") return (
    <div className="login-warning">
      <h2>🔒 Chat Bloqueado</h2>
      <p>Debes iniciar sesión para acceder al chat.</p>
    </div>
  );

  const combinedUsers = Array.from(new Set([...onlineUsers, ...allPotentialUsers, ...Object.keys(privateChats)]));
  const filteredUsers = combinedUsers.filter(u => u && u !== username);
  const chatPartners = filteredUsers.filter(u => u.toLowerCase().includes(search.toLowerCase()));

  const getUserChatDetails = user => {
    const isOnline = onlineUsers.includes(user);
    const msgs = privateChats[user] || [];
    const lastMsg = msgs[msgs.length - 1];
    const unreadCount = msgs.filter(msg => msg.recipient === username && !msg.read).length;
    return { isOnline, lastMsgText: lastMsg ? (lastMsg.sender === username ? 'Tú: ' : '') + (lastMsg.text || '📎 Archivo') : 'Iniciar chat...', unreadCount };
  };

  const currentMessages = view === "global" ? globalMessages : privateChats[selectedUser] || [];

  const renderMessage = msg => (
    <div className="message-content">
      {msg.file && (
        <div className="file-container">
          {msg.file.type.startsWith('image/') ? (
            <img src={msg.file.data} alt={msg.file.name} className="message-image" />
          ) : (
            <div className="file-attachment">
              <span className="file-icon">📎</span>
              <span className="file-name">{msg.file.name}</span>
              <span className="file-size">({(msg.file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>
      )}
      {msg.text && <div>{msg.text}</div>}
    </div>
  );

  return (
    <div className="chat-container">
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Chats ({username})</h3>
          <input
            type="text"
            placeholder="Buscar usuario..."
            className="search-user-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="users-list">
          {chatPartners.length ? chatPartners.map(user => {
            const details = getUserChatDetails(user);
            return (
              <div key={user} className={`user-item ${selectedUser === user ? 'selected' : ''}`} onClick={() => handleUserSelect(user)}>
                <div className={`avatar-placeholder ${details.isOnline ? 'online' : ''}`}>{user[0].toUpperCase()}</div>
                <div className="user-details">
                  <span className="username">{user}</span>
                  <span className="status-text">{details.lastMsgText}</span>
                </div>
                {details.unreadCount > 0 && <div className="unread-count">{details.unreadCount}</div>}
              </div>
            );
          }) : <p className="no-users">No hay usuarios para mostrar.</p>}
        </div>
      </div>

      <div className="chat-area">
        <div className="chat-header">
          <button className="back-btn" onClick={() => setSidebarOpen(true)}>←</button>
          <div className="header-info">
            {view === 'global' ? <h2>Chat Global</h2> : <>
              <h2>{selectedUser}</h2>
              <span className={`status-indicator ${getUserChatDetails(selectedUser).isOnline ? 'on' : ''}`}>
                {getUserChatDetails(selectedUser).isOnline ? 'En línea' : 'Desconectado'}
              </span>
            </>}
          </div>
        </div>

        <div className="messages-container">
          {currentMessages.length ? currentMessages.map((msg, i) => (
            <div key={i} className={`message-wrapper ${msg.sender === username ? 'sent' : 'received'}`}>
              <div className="message-bubble">
                {msg.sender !== username && <div className="message-sender">{msg.sender}</div>}
                {renderMessage(msg)}
                <span className="message-time">{new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )) : (
            <p className="empty-chat-msg">{view === 'global' ? 'Sé el primero en saludar!' : `Inicio del chat con ${selectedUser}.`}</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedFile && (
          <div className="file-preview">
            <div className="file-preview-content">
              {previewUrl ? <img src={previewUrl} alt="Preview" className="preview-image" /> : <div className="file-info"><span className="file-icon-large">📎</span><span>{selectedFile.name}</span></div>}
              <button onClick={removeFile} className="remove-file-btn">✕</button>
            </div>
          </div>
        )}

        {showEmojiPicker && (
          <div className="emoji-picker">
            {EMOJI_LIST.map(emoji => <button key={emoji} onClick={() => addEmoji(emoji)} className="emoji-btn">{emoji}</button>)}
          </div>
        )}

        <div className="input-area">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="file-input" accept="image/*,.pdf,.doc,.docx,.txt" />
          <button onClick={() => fileInputRef.current?.click()} className="icon-btn" title="Adjuntar archivo" disabled={view === 'private' && !selectedUser}>📎</button>
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="icon-btn" title="Emojis" disabled={view === 'private' && !selectedUser}>😊</button>
          <input type="text" placeholder={view === 'global' ? "Escribe un mensaje..." : `Mensaje a ${selectedUser}...`} className="chat-input" value={text} onChange={e => setText(e.target.value)} onKeyPress={handleKeyPress} disabled={view === 'private' && !selectedUser} />
          <button onClick={send} className="send-btn" disabled={view === 'private' && !selectedUser}>➡️</button>
        </div>
      </div>
    </div>
  );
}
