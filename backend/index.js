require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. CONEXIÓN BASE DE DATOS ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Conectado"))
  .catch(err => console.error("❌ Error MongoDB:", err));

const SongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  uploadedBy: String,
  audio: String, // URL de Cloudinary
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model("Song", SongSchema);

// --- 2. CONFIGURACIÓN CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gomusic_app",
    resource_type: "auto", 
  },
});
const upload = multer({ storage });

// --- 3. RUTAS API ---

// Subir canción
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta archivo" });
    
    // Guardamos en Mongo la URL que Cloudinary nos devuelve (req.file.path)
    const newSong = await Song.create({
      name: req.body.name || req.file.originalname,
      artist: req.body.artist || "Desconocido",
      uploadedBy: req.body.username,
      audio: req.file.path 
    });
    
    res.json(newSong);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar canciones
app.get("/songs", async (req, res) => {
  const songs = await Song.find().sort({ createdAt: -1 });
  res.json(songs);
});

// Buscar canciones
app.get("/search", async (req, res) => {
  const query = req.query.q || "";
  const regex = new RegExp(query, 'i');
  const songs = await Song.find({ $or: [{ name: regex }, { artist: regex }] });
  res.json(songs);
});

// --- 4. SERVIR FRONTEND REACT ---
// Importante: La ruta debe coincidir con donde React crea su carpeta build
const frontendPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));