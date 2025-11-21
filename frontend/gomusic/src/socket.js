import { io } from "socket.io-client";

// Conecta con tu backend en Render
const BACKEND_URL = "https://go-music-3mgo.onrender.com"; 

const socket = io(BACKEND_URL, {
  transports: ["websocket", "polling"], // Permite ambos para mayor compatibilidad
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 20000
});

socket.on("connect", () => {
  console.log("✅ Conectado al servidor Socket.io en Render");
});

socket.on("disconnect", (reason) => {
  console.log("🔴 Desconectado del servidor:", reason);
  if (reason === "io server disconnect") {
    // El servidor desconectó, reconectar manualmente
    socket.connect();
  }
});

socket.on("connect_error", (error) => {
  console.error("❌ Error de conexión:", error.message);
});

socket.on("reconnect", (attemptNumber) => {
  console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
});

socket.on("reconnect_attempt", (attemptNumber) => {
  console.log(`🔄 Intentando reconectar... (intento ${attemptNumber})`);
});

socket.on("reconnect_failed", () => {
  console.error("❌ No se pudo reconectar al servidor");
});

export default socket;