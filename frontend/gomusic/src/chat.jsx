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
  const username = getCurrentUser();

  useEffect(() => {
    if (!username) {
      navigate("/SESION");
      return;
    }

    fetch("/messages")
      .then(res => res.json())
      .then(data => setMessages(data));

    socket.on("newMessage", msg => {
      setMessages(prev => [...prev, msg]);

      // Contador de mensajes nuevos si la pestaña no tiene foco
      if (document.hidden) {
        setNewCount(prev => prev + 1);
      }
    });

    return () => socket.off("newMessage");
  }, [username, navigate]);

  useEffect(() => {
    // Cuando la pestaña vuelve a estar visible, reinicia el contador
    const handleVisibility = () => {
      if (!document.hidden) setNewCount(0);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const send = () => {
    if (!text.trim()) return;
    socket.emit("sendMessage", { sender: username, text });
    setText("");
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        Chat Global
        {newCount > 0 && <span style={{ marginLeft: "10px", color: "#1db954" }}>({newCount} nuevos)</span>}
      </div>

      <div className="chat-box">
        {messages.map((m, i) => (
          <p key={i}><strong>{m.sender}:</strong> {m.text}</p>
        ))}
      </div>

      <div className="chat-input-container">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
        />
        <button onClick={send}>Enviar</button>
      </div>
    </div>
  );
}
