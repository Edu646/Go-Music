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

// ==========================
// MIDDLEWARES
// ==========================
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ==========================
// VALIDACIÓN VARIABLES ENTORNO
// ==========================
if (
  !process.env.MONGO_URI ||
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Faltan variables de entorno críticas");
  process.exit(1);
}

// ==========================
// CONEXIÓN MONGODB
// ==========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });

// ==========================
// MODELOS
// ==========================
const Song = mongoose.model(
  "Song",
  new mongoose.Schema({
    name: String,
    artist: String,
    uploadedBy: String,
    audio: String,
    public_id: String,
    createdAt: { type: Date, default: Date.now },
  })
);

const Message = mongoose.model(
  "Message",
  new mongoose.Schema({
    sender: String,
    text: String,
    createdAt: { type: Date, default: Date.now },
  })
);

const PrivateMessage = mongoose.model(
  "PrivateMessage",
  new mongoose.Schema({
    sender: String,
    recipient: String,
    text: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  })
);

const Playlist = mongoose.model(
  "Playlist",
  new mongoose.Schema({
    name: String,
    owner: String,
    image: String,
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
    isPublic: { type: Boolean, default: true },
    shareToken: { type: String, unique: true, sparse: true },
    sharedWith: [String],
    createdAt: { type: Date, default: Date.now },
  })
);

// ==========================
// CLOUDINARY CONFIG
// ==========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================
// MULTER (MEMORY)
// ==========================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ==========================
// SUBIR A CLOUDINARY
// ==========================
const uploadToCloudinary = (buffer, folder, type = "auto") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: type },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ======================================================
// ✅ AVATAR PERSISTENTE EN CLOUDINARY
// ======================================================
app.post("/upload-avatar", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Falta archivo (campo: file)" });

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: "Formato no permitido" });

    const result = await uploadToCloudinary(
      req.file.buffer,
      "gomusic_avatars",
      "image"
    );

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Error upload-avatar:", err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// SUBIR CANCIÓN
// ======================================================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "Falta archivo" });

    const { name, artist, username } = req.body;

    const result = await uploadToCloudinary(
      req.file.buffer,
      "gomusic_uploads",
      "video"
    );

    const song = await Song.create({
      name: name || req.file.originalname,
      artist: artist || "Desconocido",
      uploadedBy: username || "Anónimo",
      audio: result.secure_url,
      public_id: result.public_id,
    });

    res.json(song);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// PLAYLIST CREAR
// ======================================================
app.post("/playlists", upload.single("image"), async (req, res) => {
  try {
    const { name, owner, isPublic } = req.body;
    if (!name || !owner)
      return res.status(400).json({ error: "Faltan datos" });

    let imageUrl = "";
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        "gomusic_playlists",
        "image"
      );
      imageUrl = result.secure_url;
    }

    const playlist = await Playlist.create({
      name,
      owner,
      image: imageUrl,
      isPublic: isPublic !== "false",
      shareToken:
        isPublic === "false"
          ? crypto.randomBytes(16).toString("hex")
          : null,
      songs: [],
      sharedWith: [],
    });

    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// GET PLAYLISTS USUARIO
// ======================================================
app.get("/playlists/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const own = await Playlist.find({ owner: username }).populate("songs");
    const shared = await Playlist.find({
      sharedWith: username,
      owner: { $ne: username },
    }).populate("songs");

    res.json({ own, shared });
  } catch {
    res.status(500).json({ error: "Error playlists" });
  }
});

// ======================================================
// CHAT REALTIME
// ======================================================
let onlineUsers = {};
io.on("connection", (socket) => {
  socket.on("userOnline", (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("onlineUsers", Object.keys(onlineUsers));
    }
  });
});

// ======================================================
// FRONTEND BUILD (Express 5 compatible)
// ======================================================
const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

// ⚠️ IMPORTANTE: usar RegExp en Express 5
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ======================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("🚀 Servidor listo en puerto", PORT);
});
