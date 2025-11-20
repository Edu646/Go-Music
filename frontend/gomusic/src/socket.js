import { io } from "socket.io-client";

// Conecta con tu backend en Render
const BACKEND_URL = "https://go-music-3mgo.onrender.com"; 
const socket = io(BACKEND_URL, {
  transports: ["websocket"], // evita problemas con polling
});

export default socket;
