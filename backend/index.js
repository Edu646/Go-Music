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
  public: { type: Boolean, default: false }, // 🆕 Playlists públicas/privadas
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

// --- SUBIR AUDIO ---
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
  try { res.json(await Song.find().sort({ createdAt: -1 })); }
  catch { res.status(500).json({ error: "Error obteniendo canciones" }); }
});

app.delete("/songs/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ error: "No encontrada" });

    if (song.public_id) await cloudinary.uploader.destroy(song.public_id, { resource_type: "auto" });
    await Song.findByIdAndDelete(req.params.id);

    res.json({ message: "Canción eliminada" });
  } catch {
    res.status(500).json({ error: "Error eliminando canción" });
  }
});

// -----------------
// RUTAS PLAYLIST
// -----------------

// Crear playlist con opción pública
app.post("/playlists", upload.single("image"), async (req, res) => {
  try {
    const { name, owner, isPublic } = req.body;
    if (!name || !owner) return res.status(400).json({ error: "Falta nombre o propietario" });

    let imageUrl = "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "gomusic_playlists", "image");
      imageUrl = result.secure_url;
    }

    const playlist = await Playlist.create({
      name,
      owner,
      image: imageUrl,
      public: isPublic === "true" || isPublic === true // 🆕
    });

    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener playlists del usuario
app.get("/playlists/:username", async (req, res) => {
  try { res.json(await Playlist.find({ owner: req.params.username }).populate("songs")); }
  catch { res.status(500).json({ error: "Error obteniendo playlists" }); }
});

// Añadir canción a playlist
app.post("/playlists/:id/add", async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    playlist.songs.push(req.body.song);
    await playlist.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Error agregando canción" });
  }
});

// 🆕 Obtener playlist pública para compartir por link
app.get("/playlist/public/:id", async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id).populate("songs");
    if (!playlist) return res.status(404).json({ error: "No encontrada" });
    if (!playlist.public) return res.status(403).json({ error: "No es pública" });

    res.json(playlist);
  } catch {
    res.status(500).json({ error: "Error obteniendo playlist" });
  }
});

// -----------------
// LOGIN GOOGLE 🆕
// -----------------

app.post("/auth/google", async (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email) return res.status(400).json({ error: "Debe enviar email" });

    res.json({
      success: true,
      user: { email, name, avatar }
    });
  } catch {
    res.status(500).json({ error: "Error autenticando Google" });
  }
});

// -----------------
// CHAT & SOCKET.IO
// -----------------

let onlineUsers = {};

io.on("connection", socket => {
  socket.on("userOnline", username => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async data => {
    const message = await Message.create({ sender: data.sender, text: data.text });
    io.emit("newMessage", message);
  });

  socket.on("sendPrivateMessage", async data => {
    const message = await PrivateMessage.create(data);
    socket.emit("privateMessage", message);
    const recipientSocket = onlineUsers[data.recipient];
    if (recipientSocket) io.to(recipientSocket).emit("privateMessage", message);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("onlineUsers", Object.keys(onlineUsers));
    }
  });
});

// -----------------
// SERVIR REACT
// -----------------

const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
