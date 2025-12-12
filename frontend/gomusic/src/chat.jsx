import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Smile, Paperclip, Image, X } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('https://go-music-3mgo.onrender.com', {
    autoConnect: false 
});

// Emojis populares
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
  
  // Nuevos estados para multimedia
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Para evitar duplicados
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
      const safeUsernames = userData.filter(u => u && typeof u === 'string' && u !== "Anónimo");
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
      
      const handleConnect = () => {
        socket.emit("userOnline", username);
      };
      
      socket.on('connect', handleConnect);
      
      if (socket.connected) {
        handleConnect();
      }

      socket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      socket.on("newMessage", (msg) => {
        // Evitar duplicados en chat global
        const msgId = `${msg.sender}-${msg.createdAt}-${msg.text}`;
        if (!sentMessageIds.has(msgId)) {
          setGlobalMessages(prev => [...prev, msg]);
        }
      });

      socket.on("privateMessage", (msg) => {
        // Evitar duplicados en chat privado
        const msgId = `${msg.sender}-${msg.recipient}-${msg.createdAt}-${msg.text}`;
        
        if (msg.sender === username && sentMessageIds.has(msgId)) {
          return; 
        }
        
        const otherUser = msg.sender === username ? msg.recipient : msg.sender;
        
        setPrivateChats(prev => {
          const existingMsgs = prev[otherUser] || [];
          const isDuplicate = existingMsgs.some(m => 
            m.sender === msg.sender && 
            m.text === msg.text && 
            m.createdAt === msg.createdAt
          );
          
          if (isDuplicate) return prev;
          
          return {
            ...prev,
            [otherUser]: [...existingMsgs, msg]
          };
        });
      });

      return () => {
        socket.off('connect', handleConnect);
        socket.off("onlineUsers");
        socket.off("newMessage");
        socket.off("privateMessage");
        socket.disconnect(); 
      };
    }
  }, [username, isChatDataLoaded, sentMessageIds]); 

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
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es muy grande. Máximo 5MB.");
      return;
    }
    
    setSelectedFile(file);
    
    // Crear preview para imágenes
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };
  
  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const send = async () => {
    if (!text.trim() && !selectedFile) return;
    
    const messageId = `${username}-${Date.now()}-${text || 'file'}-${Math.random()}`;
    const timestamp = new Date().toISOString();
    
    let fileData = null;
    
    // Procesar archivo si existe
    if (selectedFile) {
      const reader = new FileReader();
      fileData = await new Promise((resolve) => {
        reader.onloadend = () => {
          resolve({
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            data: reader.result
          });
        };
        reader.readAsDataURL(selectedFile);
      });
    }
    
    const messageData = {
      text: text,
      sender: username,
      createdAt: timestamp,
      file: fileData,
      messageId
    };

    // Registrar el ID del mensaje enviado
    setSentMessageIds(prev => new Set(prev).add(messageId));

    if (view === "global") {
      socket.emit("sendMessage", messageData);
      // Agregar localmente de inmediato
      setGlobalMessages(prev => [...prev, messageData]);
    } else if (view === "private" && selectedUser) {
      const privateMsgData = { ...messageData, recipient: selectedUser };
      
      socket.emit("sendPrivateMessage", privateMsgData);
      
      // Agregar localmente de inmediato
      setPrivateChats(prev => ({
        ...prev,
        [selectedUser]: [...(prev[selectedUser] || []), privateMsgData]
      }));
    }
    
    setText("");
    removeFile();
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  
  const addEmoji = (emoji) => {
    setText(prev => prev + emoji);
    setShowEmojiPicker(false);
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
      <div style={styles.loginWarning}>
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
      lastMsgText: lastMsg ? (lastMsg.sender === username ? 'Tú: ' : '') + (lastMsg.text || '📎 Archivo') : 'Iniciar chat...',
      unreadCount
    };
  };
  
  const currentMessages = view === "global" 
    ? globalMessages 
    : privateChats[selectedUser] || [];

  const renderMessage = (msg) => {
    return (
      <div style={styles.messageContent}>
        {msg.file && (
          <div style={styles.fileContainer}>
            {msg.file.type.startsWith('image/') ? (
              <img src={msg.file.data} alt={msg.file.name} style={styles.messageImage} />
            ) : (
              <div style={styles.fileAttachment}>
                <Paperclip size={16} />
                <span>{msg.file.name}</span>
                <span style={styles.fileSize}>({(msg.file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
        )}
        {msg.text && <div>{msg.text}</div>}
      </div>
    );
  };

  return !isChatDataLoaded ? (
    <div style={styles.loadingContainer}>
      <h2>Cargar Mensajes</h2>
      <p>El chat está listo, pero la carga de mensajes está suspendida.</p>
      <button onClick={loadChatData} style={styles.loadBtn}>
        Abrir y Cargar Chats Ahora
      </button>
    </div>
  ) : (
    <div style={styles.chatContainer}>
      {sidebarOpen && <div style={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />}

      <div style={{...styles.sidebar, ...(sidebarOpen ? styles.sidebarOpen : {})}}>
        <div style={styles.sidebarHeader}>
          <h3 style={styles.sidebarTitle}>Chats ({username})</h3>
          <button 
            style={{...styles.globalChatBtn, ...(view === 'global' ? styles.globalChatBtnActive : {})}}
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
            style={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div style={styles.usersList}>
          <h4 style={styles.listTitle}>Contactos:</h4>
          {chatPartners.length > 0 ? chatPartners.map(user => {
            const details = getUserChatDetails(user);
            
            return (
              <div 
                key={user} 
                style={{...styles.userItem, ...(selectedUser === user ? styles.userItemSelected : {})}}
                onClick={() => handleUserSelect(user)}
              >
                <div style={{...styles.avatar, ...(details.isOnline ? styles.avatarOnline : {})}}>
                  {user[0].toUpperCase()}
                </div>
                <div style={styles.userDetails}>
                  <span style={styles.username}>{user}</span>
                  <span style={styles.statusText}>{details.lastMsgText}</span>
                </div>
                {details.unreadCount > 0 && (
                  <div style={styles.unreadCount}>{details.unreadCount}</div>
                )}
              </div>
            );
          }) : (
            <p style={styles.noUsers}>No hay usuarios para mostrar.</p>
          )}
        </div>
      </div>
      
      <div style={styles.chatArea}>
        <div style={styles.chatHeader}>
          <button 
            style={styles.backBtn}
            onClick={() => setSidebarOpen(true)}
          >
            ←
          </button>
          
          <div style={styles.headerInfo}>
            {view === 'global' ? (
              <h2 style={styles.headerTitle}>Chat Global</h2>
            ) : (
              <>
                <h2 style={styles.headerTitle}>{selectedUser}</h2>
                <span style={{...styles.statusIndicator, ...(getUserChatDetails(selectedUser).isOnline ? styles.statusOnline : {})}}>
                  {getUserChatDetails(selectedUser).isOnline ? 'En línea' : 'Desconectado'}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div style={styles.messagesContainer}>
          {currentMessages.length > 0 ? currentMessages.map((msg, index) => (
            <div key={index} style={{...styles.messageWrapper, ...(msg.sender === username ? styles.messageSent : styles.messageReceived)}}>
              <div style={styles.messageBubble}>
                {msg.sender !== username && (
                  <div style={styles.messageSender}>{msg.sender}</div>
                )}
                
                {renderMessage(msg)}
                
                <span style={styles.messageTime}>
                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )) : (
            <p style={styles.emptyChatMsg}>
              {view === 'global' ? 'Sé el primero en saludar!' : `Es el inicio de tu chat con ${selectedUser}.`}
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Preview de archivo seleccionado */}
        {selectedFile && (
          <div style={styles.filePreview}>
            <div style={styles.filePreviewContent}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" style={styles.previewImage} />
              ) : (
                <div style={styles.fileInfo}>
                  <Paperclip size={24} />
                  <span>{selectedFile.name}</span>
                </div>
              )}
              <button onClick={removeFile} style={styles.removeFileBtn}>
                <X size={20} />
              </button>
            </div>
          </div>
        )}
        
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div style={styles.emojiPicker}>
            {EMOJI_LIST.map(emoji => (
              <button 
                key={emoji} 
                onClick={() => addEmoji(emoji)}
                style={styles.emojiBtn}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        <div style={styles.inputArea}>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={styles.fileInput}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            style={styles.iconBtn}
            title="Adjuntar archivo"
            disabled={view === 'private' && !selectedUser}
          >
            <Paperclip size={20} />
          </button>
          
          <button 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={styles.iconBtn}
            title="Emojis"
            disabled={view === 'private' && !selectedUser}
          >
            <Smile size={20} />
          </button>
          
          <input 
            type="text"
            placeholder={view === 'global' ? "Escribe un mensaje..." : `Mensaje a ${selectedUser}...`}
            style={styles.chatInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={view === 'private' && !selectedUser}
          />
          
          <button 
            onClick={send} 
            style={{...styles.sendBtn, ...((view === 'private' && !selectedUser) ? styles.sendBtnDisabled : {})}}
            disabled={view === 'private' && !selectedUser}
          >
            ➡️
          </button>
        </div>
      </div>
    </div>
  );
}
