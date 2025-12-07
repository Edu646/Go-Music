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
const io = new Server(server, { cors: { origin: "*" } });

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

// -----------------
// MODELOS
// -----------------

const SongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  uploadedBy: String,
  audio: String,
  public_id: String,
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model("Song", SongSchema);

const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

const PrivateMessageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  text: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const PrivateMessage = mongoose.model("PrivateMessage", PrivateMessageSchema);

// --- MODELO PLAYLIST ---
const PlaylistSchema = new mongoose.Schema({
  name: String,
  owner: String,
  image: String,
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
  createdAt: { type: Date, default: Date.now }
});
const Playlist = mongoose.model("Playlist", PlaylistSchema);

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
const uploadToCloudinary = (buffer, folder = "gomusic_uploads", resource_type = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// -----------------
// RUTAS SONGS
// -----------------
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

    if (song.public_id) await cloudinary.uploader.destroy(song.public_id, { resource_type: "auto" });
    await Song.findByIdAndDelete(req.params.id);
    res.json({ message: "Canción eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando canción" });
  }
});

// -----------------
// RUTAS PLAYLIST
// -----------------

// Crear playlist
app.post("/playlists", upload.single("image"), async (req, res) => {
  try {
    const { name, owner } = req.body;
    if (!name || !owner) return res.status(400).json({ error: "Falta nombre o propietario" });

    let imageUrl = "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "gomusic_playlists", "image");
      imageUrl = result.secure_url;
    }

    const playlist = await Playlist.create({ name, owner, image: imageUrl, songs: [] });
    res.json(playlist);
  } catch (err) {
    console.error("Error creando playlist:", err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener playlists de un usuario
app.get("/playlists/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const playlists = await Playlist.find({ owner: username }).populate("songs");
    res.json(playlists);
  } catch (err) {
    console.error("Error obteniendo playlists:", err);
    res.status(500).json({ error: "Error obteniendo playlists" });
  }
});

// Agregar canción a playlist
app.post("/playlists/:id/add", async (req, res) => {
  try {
    const { id } = req.params;
    const { song } = req.body;
    if (!song) return res.status(400).json({ error: "Falta canción" });

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    playlist.songs.push(song._id || song.id);
    await playlist.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error agregando canción:", err);
    res.status(500).json({ error: "Error agregando canción a playlist" });
  }
});

app.get("/api/playlists/public", async (req, res) => {
  try {
    const playlists = await Playlist.find().populate("songs").sort({ createdAt: -1 }).limit(8);
    res.json(playlists);
  } catch (err) {
    console.error("Error obteniendo playlists públicas:", err);
    res.status(500).json({ error: "Error obteniendo playlists públicas" });
  }
});

// -----------------
// RUTAS SEARCH Y USUARIOS
// -----------------
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);
    const regex = new RegExp(q.trim(), "i");
    const songs = await Song.find({ $or: [{ name: regex }, { artist: regex }] }).sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    console.error("Error en /search:", err);
    res.status(500).json({ error: "Error buscando canciones" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const privateSenders = await PrivateMessage.distinct("sender");
    const privateRecipients = await PrivateMessage.distinct("recipient");
    const globalSenders = await Message.distinct("sender");
    const songUploaders = await Song.distinct("uploadedBy");

    let allUsers = [...privateSenders, ...privateRecipients, ...globalSenders, ...songUploaders];
    allUsers = Array.from(new Set(allUsers)).filter(u => u && u.trim() && u !== "Anónimo" && u !== "Desconocido");
    res.json(allUsers);
  } catch (err) {
    console.error("Error obteniendo lista de usuarios:", err);
    res.status(500).json({ error: "Error obteniendo lista de usuarios" });
  }
});

// -----------------
// RUTAS CHAT (GLOBAL Y PRIVADO)
// -----------------
app.get("/messages", async (req, res) => {
  try { const msgs = await Message.find().sort({ createdAt: 1 }); res.json(msgs); }
  catch (err) { res.status(500).json({ error: "Error obteniendo mensajes" }); }
});

app.get("/private-messages", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Falta parámetro username" });
    const msgs = await PrivateMessage.find({ $or: [{ sender: username }, { recipient: username }] }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: "Error obteniendo mensajes privados" }); }
});

app.post("/private-messages/mark-read", async (req, res) => {
  try {
    const { username, sender } = req.body;
    await PrivateMessage.updateMany({ sender, recipient: username, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error marcando mensajes como leídos" }); }
});

// -----------------
// CHAT EN TIEMPO REAL
// -----------------
let onlineUsers = {};
io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  socket.on("userOnline", username => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async (data) => {
    try { const message = await Message.create({ sender: data.sender, text: data.text }); io.emit("newMessage", message); }
    catch (err) { console.error("Error guardando mensaje global:", err); }
  });

  socket.on("sendPrivateMessage", async (data) => {
    try {
      const message = await PrivateMessage.create({ sender: data.sender, recipient: data.recipient, text: data.text });
      socket.emit("privateMessage", message);
      const recipientSocketId = onlineUsers[data.recipient];
      if (recipientSocketId) io.to(recipientSocketId).emit("privateMessage", message);
    } catch (err) { console.error("Error guardando mensaje privado:", err); }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("onlineUsers", Object.keys(onlineUsers));
    }
  });
});

// -----------------
// FRONTEND REACT
// -----------------
const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

// IMPORTANTE: colocar rutas API **antes** de este catch-all
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// -----------------
// INICIO DEL SERVIDOR
// -----------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Servidor listo en puerto ${PORT}`);
  console.log(`📁 Frontend servido desde: ${frontendPath}`);
});
