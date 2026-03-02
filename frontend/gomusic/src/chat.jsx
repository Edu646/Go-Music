import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./chat.css";
import io from "socket.io-client";

const API_BASE = "https://go-music-3mgo.onrender.com";
const socket = io(API_BASE, { autoConnect: false });

const EMOJI_LIST = [
  "😀","😂","😍","🥰","😎","🤔","👍","👏","🎉",
  "❤️","🔥","✨","🎵","🎸","🎤","🎧"
];

// ==========================
// 🔹 RESOLVER URL AVATAR
// ==========================
const resolveAvatarUrl = (avatar) => {
  if (!avatar || typeof avatar !== "string") return null;

  const value = avatar.trim();
  if (!value) return null;

  // Ya es absoluta o base64
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  // Si es relativa -> convertirla al backend
  if (value.startsWith("/")) {
    return `${API_BASE}${value}`;
  }

  return `${API_BASE}/${value}`;
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("gomusic_user")) || null;
  } catch {
    return null;
  }
};

export default function Chat() {

  const me = getStoredUser();
  const username = me?.username || "Anónimo";
  const myAvatar = resolveAvatarUrl(
    me?.avatar || me?.photoURL || me?.photo || me?.image || null
  );

  const [view, setView] = useState("global");
  const [text, setText] = useState("");
  const [globalMessages, setGlobalMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [sentMessageIds, setSentMessageIds] = useState(new Set());

  const messagesEndRef = useRef(null);

  // ==========================
  // 🔹 CARGAR DATOS
  // ==========================
  useEffect(() => {
    if (!username || username === "Anónimo") return;

    socket.connect();
    socket.emit("userOnline", username);

    fetch(`${API_BASE}/messages`)
      .then(res => res.json())
      .then(data => setGlobalMessages(Array.isArray(data) ? data : []))
      .catch(() => setGlobalMessages([]));

    fetch(`${API_BASE}/private-messages?username=${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => {
        const chats = {};
        (Array.isArray(data) ? data : []).forEach(msg => {
          const other = msg.sender === username ? msg.recipient : msg.sender;
          if (!chats[other]) chats[other] = [];
          chats[other].push(msg);
        });
        setPrivateChats(chats);
      })
      .catch(() => setPrivateChats({}));

    fetch(`${API_BASE}/users`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return setAllUsers([]);
        const normalized = data.map(u => {
          if (!u) return null;
          const uname = u.username || u.user || u.name || u.email;
          const avatar = resolveAvatarUrl(
            u.avatar || u.photo || u.image || u.profileImage || u.photoURL
          );
          return uname ? { username: uname, avatar } : null;
        }).filter(Boolean);
        setAllUsers(normalized);
      })
      .catch(() => setAllUsers([]));

    socket.on("onlineUsers", setOnlineUsers);

    socket.on("newMessage", msg => {
      setGlobalMessages(prev => [...prev, msg]);
    });

    socket.on("privateMessage", msg => {
      const other = msg.sender === username ? msg.recipient : msg.sender;
      setPrivateChats(prev => ({
        ...prev,
        [other]: [...(prev[other] || []), msg]
      }));
    });

    return () => {
      socket.disconnect();
    };

  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, privateChats, selectedUser]);

  // ==========================
  // 🔹 MAPA DE AVATARES
  // ==========================
  const avatarMap = useMemo(() => {
    const map = new Map();
    allUsers.forEach(u => map.set(u.username, u.avatar));
    if (username && myAvatar) map.set(username, myAvatar);
    return map;
  }, [allUsers, username, myAvatar]);

  const getAvatar = (user) => avatarMap.get(user) || null;

  // ==========================
  // 🔹 COMPONENTE AVATAR
  // ==========================
  const UserAvatar = ({ user, isOnline }) => {
    const avatar = getAvatar(user);
    const [error, setError] = useState(false);

    if (avatar && !error) {
      return (
        <img
          src={avatar}
          alt={user}
          className={`user-avatar-img ${isOnline ? "online" : ""}`}
          onError={() => setError(true)}
        />
      );
    }

    return (
      <div className={`avatar-placeholder ${isOnline ? "online" : ""}`}>
        {user?.[0]?.toUpperCase()}
      </div>
    );
  };

  // ==========================
  // 🔹 ENVIAR MENSAJE
  // ==========================
  const send = () => {
    if (!text.trim()) return;

    const msg = {
      text,
      sender: username,
      createdAt: new Date().toISOString()
    };

    if (view === "global") {
      socket.emit("sendMessage", msg);
      setGlobalMessages(prev => [...prev, msg]);
    } else if (selectedUser) {
      socket.emit("sendPrivateMessage", { ...msg, recipient: selectedUser });
      setPrivateChats(prev => ({
        ...prev,
        [selectedUser]: [...(prev[selectedUser] || []), { ...msg, recipient: selectedUser }]
      }));
    }

    setText("");
  };

  if (username === "Anónimo") {
    return (
      <div className="login-warning">
        <h2>🔒 Chat Bloqueado</h2>
        <p>Debes iniciar sesión.</p>
      </div>
    );
  }

  const usersList = Array.from(
    new Set([
      ...onlineUsers,
      ...allUsers.map(u => u.username),
      ...Object.keys(privateChats)
    ])
  ).filter(u => u !== username);

  const filteredUsers = usersList.filter(u =>
    u.toLowerCase().includes(search.toLowerCase())
  );

  const currentMessages =
    view === "global" ? globalMessages : privateChats[selectedUser] || [];

  return (
    <div className="chat-container">

      <div className="sidebar">
        <h3>Chats ({username})</h3>
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {filteredUsers.map(user => (
          <div
            key={user}
            className={`user-item ${selectedUser === user ? "selected" : ""}`}
            onClick={() => {
              setSelectedUser(user);
              setView("private");
            }}
          >
            <UserAvatar user={user} isOnline={onlineUsers.includes(user)} />
            <span>{user}</span>
          </div>
        ))}
      </div>

      <div className="chat-area">

        <div className="chat-header">
          {view === "global" ? (
            <h2>Chat Global</h2>
          ) : (
            <div className="header-user">
              <UserAvatar
                user={selectedUser}
                isOnline={onlineUsers.includes(selectedUser)}
              />
              <h2>{selectedUser}</h2>
            </div>
          )}
        </div>

        <div className="messages-container">
          {currentMessages.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.sender === username ? "sent" : "received"}`}
            >
              {msg.sender !== username && <strong>{msg.sender}</strong>}
              <div>{msg.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder="Escribe un mensaje..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button onClick={send}>Enviar</button>
        </div>

      </div>
    </div>
  );
}
