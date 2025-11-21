require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// --- VALIDACIÓN VARIABLES ENTORNO ---
if (!process.env.MONGO_URI || !process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("❌ Faltan variables de entorno críticas");
  process.exit(1);
}

// --- CONEXIÓN MONGODB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => {
    console.error("❌ Error conectando a MongoDB:", err);
    process.exit(1);
  });

// --- MODELO CANCIONES ---
const SongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  uploadedBy: String,
  audio: String,
  public_id: String,
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model("Song", SongSchema);

// --- MODELO MENSAJES DE CHAT GLOBAL ---
const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

// --- MODELO MENSAJES PRIVADOS ---
const PrivateMessageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  text: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const PrivateMessage = mongoose.model("PrivateMessage", PrivateMessageSchema);

// --- CONFIG CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- SUBIR AUDIO A CLOUDINARY ---
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "gomusic_uploads",
        resource_type: "auto"
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// -------------------------------------------------------
//  RUTAS API DE AUDIOS
// -------------------------------------------------------

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta archivo" });

    const { name, artist, username } = req.body;

    const result = await uploadToCloudinary(req.file.buffer);

    const newSong = await Song.create({
      name: name || req.file.originalname,
      artist: artist || "Desconocido",
      uploadedBy: username || "Anónimo",
      audio: result.secure_url,
      public_id: result.public_id
    });

    res.json(newSong);
  } catch (err) {
    res.status(500).json({ error: "Error subiendo canción: " + err.message });
  }
});

app.get("/songs", async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json(songs);
  } catch {
    res.status(500).json({ error: "Error obteniendo canciones" });
  }
});

app.delete("/songs/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ error: "No encontrada" });

    if (song.public_id) {
      // Usamos 'video' como resource_type ya que cloudinary puede detectar audios como videos
      await cloudinary.uploader.destroy(song.public_id, { resource_type: "video" }); 
    }

    await Song.findByIdAndDelete(req.params.id);
    res.json({ message: "Canción eliminada" });
  } catch {
    res.status(500).json({ error: "Error eliminando canción" });
  }
});

// -------------------------------------------------------
//  RUTAS DE CHAT
// -------------------------------------------------------

// Obtener mensajes globales
app.get("/messages", async (req, res) => {
  try {
    const msgs = await Message.find().sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo mensajes" });
  }
});

// Obtener mensajes privados del usuario
app.get("/private-messages", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: "Falta parámetro username" });
    }

    const msgs = await PrivateMessage.find({
      $or: [
        { sender: username },
        { recipient: username }
      ]
    }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo mensajes privados" });
  }
});

// Marcar mensajes como leídos
app.post("/private-messages/mark-read", async (req, res) => {
  try {
    const { username, sender } = req.body;
    await PrivateMessage.updateMany(
      { sender: sender, recipient: username, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error marcando mensajes como leídos" });
  }
});

// -------------------------------------------------------
// RUTA NUEVA: Obtener la lista de todos los usuarios (para el buscador del frontend)
// -------------------------------------------------------

app.get("/users", async (req, res) => {
  try {
    // 1. Obtener nombres únicos de PrivateMessage
    const privateSenders = await PrivateMessage.distinct('sender');
    const privateRecipients = await PrivateMessage.distinct('recipient');

    // 2. Obtener nombres únicos de Message
    const globalSenders = await Message.distinct('sender');
    
    // 3. Obtener nombres únicos de Song uploaders
    const songUploaders = await Song.distinct('uploadedBy');

    // Combinar, eliminar duplicados y limpiar nombres genéricos
    let allUsers = [...privateSenders, ...privateRecipients, ...globalSenders, ...songUploaders];
    
    allUsers = Array.from(new Set(allUsers)).filter(u => 
        u && 
        u !== "Anónimo" && 
        u !== "Desconocido" && 
        u.trim() !== ""
    );

    res.json(allUsers);
  } catch (err) {
    console.error("Error obteniendo lista de usuarios:", err);
    res.status(500).json({ error: "Error obteniendo lista de usuarios" });
  }
});

// -------------------------------------------------------
//  CHAT EN TIEMPO REAL CON SOCKET.IO
// -------------------------------------------------------

// ... (El código Socket.io es el mismo y no necesita cambios)

let onlineUsers = {}; 

io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  socket.on("userOnline", (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    console.log(`👤 ${username} está en línea`);
    
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async (data) => {
    try {
      const message = await Message.create({
        sender: data.sender,
        text: data.text
      });
      io.emit("newMessage", message);
    } catch (err) {
      console.error("Error guardando mensaje global:", err);
    }
  });

  socket.on("sendPrivateMessage", async (data) => {
    try {
      const message = await PrivateMessage.create({
        sender: data.sender,
        recipient: data.recipient,
        text: data.text
      });

      socket.emit("privateMessage", message);

      const recipientSocketId = onlineUsers[data.recipient];
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("privateMessage", message);
      }
    } catch (err) {
      console.error("Error guardando mensaje privado:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      console.log(`🔴 ${socket.username} se desconectó`);
      io.emit("onlineUsers", Object.keys(onlineUsers));
    }
  });
});

// -------------------------------------------------------
//  FRONTEND REACT
// -------------------------------------------------------

const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// -------------------------------------------------------
//  INICIO DEL SERVIDOR
// -------------------------------------------------------

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`✅ Servidor con chat privado listo en puerto ${PORT}`);
  console.log(`📁 Frontend servido desde: ${frontendPath}`);
});