import { useState, useEffect } from "react";
import socket from "../socket";

export default function Chat({ username }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    fetch("/messages")
      .then(res => res.json())
      .then(data => setMessages(data));

    socket.on("newMessage", msg => {
      setMessages(prev => [...prev, msg]);
    });

    return () => socket.off("newMessage");
  }, []);

  const send = () => {
    socket.emit("sendMessage", {
      sender: username,
      text
    });
    setText("");
  };

  return (
    <div>
      <h2>Chat Global</h2>

      <div className="chat-box">
        {messages.map((m, i) => (
          <p key={i}><strong>{m.sender}:</strong> {m.text}</p>
        ))}
      </div>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escribe un mensaje..."
      />
      <button onClick={send}>Enviar</button>
    </div>
  );
}
