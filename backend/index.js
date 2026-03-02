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
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// -----------------
// MIDDLEWARES
// -----------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// -----------------
// VALIDACIÓN VARIABLES ENTORNO
// -----------------
if (
  !process.env.MONGO_URI ||
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Faltan variables de entorno críticas");
  console.error("Necesitas: MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
  process.exit(1);
}

// -----------------
// CONEXIÓN MONGODB
// -----------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => {
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
  createdAt: { type: Date, default: Date.now },
});
const Song = mongoose.model("Song", SongSchema);

const MessageSchema = new mongoose.Schema({
  sender: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MessageSchema);

const PrivateMessageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  text: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const PrivateMessage = mongoose.model("PrivateMessage", PrivateMessageSchema);

const PlaylistSchema = new mongoose.Schema({
  name: String,
  owner: String,
  image: String,
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
  isPublic: { type: Boolean, default: true },
  shareToken: { type: String, unique: true, sparse: true },
  sharedWith: [String],
  createdAt: { type: Date, default: Date.now },
});
const Playlist = mongoose.model("Playlist", PlaylistSchema);

// -----------------
// CONFIG CLOUDINARY
// -----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -----------------
// MULTER (MEMORY)
// -----------------
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// -----------------
// SUBIR A CLOUDINARY
// -----------------
const uploadToCloudinary = (buffer, folder = "gomusic_uploads", resource_type = "auto") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ============================================================================
// ✅ AVATARS (PERSISTENTES EN CLOUDINARY)
// Endpoint: POST /upload-avatar  (FormData -> file)
// Devuelve: { url, public_id }
// ============================================================================
app.post("/upload-avatar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta archivo (campo: file)" });

    // Validación básica de mimetype (evita subir cosas raras)
    const ok = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(req.file.mimetype);
    if (!ok) return res.status(400).json({ error: "Formato no permitido. Usa JPG/PNG/WebP" });

    const result = await uploadToCloudinary(req.file.buffer, "gomusic_avatars", "image");
    return res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("❌ Error subiendo avatar:", err);
    return res.status(500).json({ error: "Error subiendo avatar: " + err.message });
  }
});

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
      public_id: result.public_id,
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
    console.log("🗑️ Intentando eliminar canción con ID:", req.params.id);

    const song = await Song.findById(req.params.id);

    if (!song) {
      console.log("❌ Canción no encontrada");
      return res.status(404).json({ error: "No encontrada" });
    }

    console.log("✅ Canción encontrada:", song.name);

    if (song.public_id) {
      console.log("☁️ Eliminando de Cloudinary:", song.public_id);
      try {
        // Tus audios suelen ir como video en Cloudinary (por compatibilidad)
        await cloudinary.uploader.destroy(song.public_id, { resource_type: "video" });
        console.log("✅ Eliminado de Cloudinary");
      } catch (cloudErr) {
        console.error("⚠️ Error eliminando de Cloudinary (continuando):", cloudErr);
      }
    }

    await Song.findByIdAndDelete(req.params.id);
    console.log("✅ Canción eliminada de MongoDB");

    res.json({ message: "Canción eliminada" });
  } catch (err) {
    console.error("❌ ERROR COMPLETO:", err);
    res.status(500).json({
      error: "Error eliminando canción",
      details: err.message,
    });
  }
});

// -----------------
// RUTAS PLAYLIST
// -----------------

// 1. Crear playlist
app.post("/playlists", upload.single("image"), async (req, res) => {
  try {
    const { name, owner, isPublic } = req.body;
    if (!name || !owner) return res.status(400).json({ error: "Falta nombre o propietario" });

    let imageUrl = "";
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "gomusic_playlists", "image");
      imageUrl = result.secure_url;
    }

    const shareToken = isPublic === "false" ? crypto.randomBytes(16).toString("hex") : null;

    const playlist = await Playlist.create({
      name,
      owner,
      image: imageUrl,
      songs: [],
      isPublic: isPublic !== "false",
      shareToken,
      sharedWith: [],
    });

    res.json(playlist);
  } catch (err) {
    console.error("Error creando playlist:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Obtener playlists públicas
app.get("/playlists", async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate("songs")
      .sort({ createdAt: -1 });
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo playlists públicas" });
  }
});

// 3. Obtener playlists del usuario (propias + compartidas)
app.get("/playlists/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const ownPlaylists = await Playlist.find({ owner: username }).populate("songs");

    const sharedPlaylists = await Playlist.find({
      sharedWith: username,
      owner: { $ne: username },
    }).populate("songs");

    res.json({
      own: ownPlaylists,
      shared: sharedPlaylists,
    });
  } catch (err) {
    console.error("Error obteniendo playlists:", err);
    res.status(500).json({ error: "Error obteniendo playlists" });
  }
});

// 4. Aceptar playlist compartida por token
app.post("/playlists/accept-share", async (req, res) => {
  try {
    const { token, username } = req.body;

    if (!token || !username) return res.status(400).json({ error: "Faltan datos" });

    const playlist = await Playlist.findOne({ shareToken: token });
    if (!playlist) return res.status(404).json({ error: "Link inválido o expirado" });

    if (playlist.owner === username) return res.status(400).json({ error: "Ya eres el dueño de esta playlist" });
    if (playlist.sharedWith.includes(username)) return res.status(400).json({ error: "Ya tienes acceso a esta playlist" });

    playlist.sharedWith.push(username);
    await playlist.save();

    const updated = await Playlist.findById(playlist._id).populate("songs");
    res.json({ success: true, playlist: updated });
  } catch (err) {
    console.error("Error aceptando playlist:", err);
    res.status(500).json({ error: "Error al aceptar playlist" });
  }
});

// 5. Regenerar token
app.post("/playlists/:id/regenerate-token", async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner !== username) return res.status(403).json({ error: "Solo el dueño puede hacer esto" });

    playlist.shareToken = crypto.randomBytes(16).toString("hex");
    await playlist.save();

    res.json({ shareToken: playlist.shareToken });
  } catch (err) {
    res.status(500).json({ error: "Error regenerando token" });
  }
});

// 6. Cambiar privacidad
app.patch("/playlists/:id/privacy", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, isPublic } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner !== username) return res.status(403).json({ error: "Solo el dueño puede cambiar la privacidad" });

    playlist.isPublic = isPublic;

    if (!isPublic && !playlist.shareToken) {
      playlist.shareToken = crypto.randomBytes(16).toString("hex");
    }

    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: "Error cambiando privacidad" });
  }
});

// 7. Agregar canción (solo dueño)
app.post("/playlists/:id/add", async (req, res) => {
  try {
    const { id } = req.params;
    const { song, username } = req.body;

    if (!song || !username) return res.status(400).json({ error: "Faltan datos" });

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner !== username) return res.status(403).json({ error: "Solo el dueño puede editar esta playlist" });

    const songId = song._id || song.id;
    if (!songId) return res.status(400).json({ error: "Song inválida (sin id)" });

    if (playlist.songs.includes(songId)) return res.status(400).json({ error: "La canción ya está en la playlist" });

    playlist.songs.push(songId);
    await playlist.save();

    const updated = await Playlist.findById(id).populate("songs");
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error agregando canción" });
  }
});

// 7b. Actualizar playlist (para “Quitar”)
app.put("/playlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { songs, username } = req.body;

    if (!username) return res.status(400).json({ error: "Falta username" });
    if (!Array.isArray(songs)) return res.status(400).json({ error: "songs debe ser un array" });

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner !== username) return res.status(403).json({ error: "Solo el dueño puede editar esta playlist" });

    playlist.songs = songs.map((s) => s?._id || s);
    await playlist.save();

    const updated = await Playlist.findById(id).populate("songs");
    res.json(updated);
  } catch (err) {
    console.error("Error actualizando playlist:", err);
    res.status(500).json({ error: "Error actualizando playlist" });
  }
});

// 8. Eliminar playlist (solo dueño)
app.delete("/playlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "No encontrada" });

    if (playlist.owner !== username) return res.status(403).json({ error: "Solo el dueño puede eliminar" });

    await Playlist.findByIdAndDelete(id);
    res.json({ success: true, message: "Playlist eliminada" });
  } catch (err) {
    res.status(500).json({ error: "Error al borrar playlist" });
  }
});

// 9. Quitar playlist compartida de la biblioteca
app.delete("/playlists/:id/remove-from-library", async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: "Falta username" });

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner === username) {
      return res.status(400).json({ error: "No puedes quitar tu propia playlist de tu biblioteca" });
    }

    if (!Array.isArray(playlist.sharedWith)) playlist.sharedWith = [];

    const before = playlist.sharedWith.length;
    playlist.sharedWith = playlist.sharedWith.filter((u) => u !== username);
    const removed = playlist.sharedWith.length !== before;

    if (removed) await playlist.save();

    res.json({ ok: true, removed });
  } catch (err) {
    console.error("Error remove-from-library:", err);
    res.status(500).json({ error: "Error quitando playlist compartida" });
  }
});

// 9b. Añadir playlist compartida a la biblioteca (desde públicas)
app.post("/playlists/:id/add-to-library", async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: "Falta username" });

    const playlist = await Playlist.findById(id);
    if (!playlist) return res.status(404).json({ error: "Playlist no encontrada" });

    if (playlist.owner === username) return res.status(200).json({ ok: true, already: true, reason: "owner" });

    if (!Array.isArray(playlist.sharedWith)) playlist.sharedWith = [];

    if (playlist.sharedWith.includes(username)) return res.status(200).json({ ok: true, already: true });

    playlist.sharedWith.push(username);
    await playlist.save();

    const updated = await Playlist.findById(id).populate("songs");
    return res.json({ ok: true, added: true, playlist: updated });
  } catch (err) {
    console.error("Error add-to-library:", err);
    res.status(500).json({ error: "Error añadiendo playlist a la biblioteca" });
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
    allUsers = Array.from(new Set(allUsers)).filter(
      (u) => u && u.trim() && u !== "Anónimo" && u !== "Desconocido"
    );

    res.json(allUsers);
  } catch (err) {
    console.error("Error obteniendo lista de usuarios:", err);
    res.status(500).json({ error: "Error obteniendo lista de usuarios" });
  }
});

app.delete("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;

    await Song.deleteMany({ uploadedBy: username });
    await Message.deleteMany({ sender: username });
    await PrivateMessage.deleteMany({ $or: [{ sender: username }, { recipient: username }] });
    await Playlist.deleteMany({ owner: username });

    res.json({ success: true, message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando usuario" });
  }
});

// -----------------
// RUTAS CHAT
// -----------------
app.get("/messages", async (req, res) => {
  try {
    const msgs = await Message.find().sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo mensajes" });
  }
});

app.get("/private-messages", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Falta parámetro username" });

    const msgs = await PrivateMessage.find({
      $or: [{ sender: username }, { recipient: username }],
    }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo mensajes privados" });
  }
});

app.post("/private-messages/mark-read", async (req, res) => {
  try {
    const { username, sender } = req.body;
    await PrivateMessage.updateMany({ sender, recipient: username, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error marcando mensajes como leídos" });
  }
});

// -----------------
// CHAT EN TIEMPO REAL
// -----------------
let onlineUsers = {};
io.on("connection", (socket) => {
  console.log("🟢 Usuario conectado:", socket.id);

  socket.on("userOnline", (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("sendMessage", async (data) => {
    try {
      const message = await Message.create({ sender: data.sender, text: data.text });
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
        text: data.text,
      });

      socket.emit("privateMessage", message);

      const recipientSocketId = onlineUsers[data.recipient];
      if (recipientSocketId) io.to(recipientSocketId).emit("privateMessage", message);
    } catch (err) {
      console.error("Error guardando mensaje privado:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("onlineUsers", Object.keys(onlineUsers));
    }
  });
});

// -----------------
// FRONTEND REACT (BUILD)
// -----------------
const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

// ✅ MUY IMPORTANTE: el catch-all SOLO para GET (si no, te rompe 404 de APIs en POST/PUT/etc)
app.get("*", (req, res) => {
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
