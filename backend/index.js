require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
app.use(cors());
app.use(express.json());

// Validación de variables de entorno
if (!process.env.MONGO_URI || !process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("❌ Faltan variables de entorno críticas");
  process.exit(1);
}

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => {
    console.error("❌ Error conectando a MongoDB:", err);
    process.exit(1);
  });

// Definir cómo se ve una canción en la base de datos
const SongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  uploadedBy: String,
  audio: String,
  public_id: String,
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model("Song", SongSchema);

// --- CONFIGURACIÓN CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuración de storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gomusic_uploads",
    resource_type: "auto",
    allowed_formats: ["mp3", "wav", "ogg", "m4a", "flac"]
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- ENDPOINTS API (deben ir ANTES del frontend) ---

// 1. Subir Canción
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Falta el archivo de audio" });
    }
    
    const { name, artist, username } = req.body;

    const newSong = await Song.create({
      name: name || req.file.originalname,
      artist: artist || "Desconocido",
      uploadedBy: username || "Anónimo",
      audio: req.file.path,
      public_id: req.file.filename
    });

    console.log("✅ Canción subida:", newSong.name);
    res.json(newSong);
  } catch (err) {
    console.error("❌ Error al subir:", err);
    res.status(500).json({ error: "Error al subir la canción" });
  }
});

// 2. Listar Canciones
app.get("/songs", async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    console.error("❌ Error obteniendo canciones:", err);
    res.status(500).json({ error: "Error obteniendo canciones" });
  }
});

// 3. Buscar Canciones
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      const all = await Song.find().sort({ createdAt: -1 });
      return res.json(all);
    }
    const results = await Song.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { artist: { $regex: query, $options: "i" } }
      ]
    }).sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    console.error("❌ Error buscando:", err);
    res.status(500).json({ error: "Error buscando canciones" });
  }
});

// 4. Eliminar Canción
app.delete("/songs/:id", async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: "Canción no encontrada" });
    }

    if (song.public_id) {
      await cloudinary.uploader.destroy(song.public_id, { resource_type: "video" });
    }

    await Song.findByIdAndDelete(req.params.id);
    
    console.log("✅ Canción eliminada:", song.name);
    res.json({ message: "Canción eliminada correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar:", err);
    res.status(500).json({ error: "Error al eliminar la canción" });
  }
});

// --- FRONTEND (debe ir DESPUÉS de todas las rutas API) ---
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));

// Catch-all route - CORREGIDO (sin el asterisco problemático)
app.get("/*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// --- INICIO ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor listo en puerto ${PORT}`);
  console.log(`📁 Sirviendo frontend desde: ${frontendBuildPath}`);
});