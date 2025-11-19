require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");

// 🛠 CORRECCIÓN DEL ERROR: Importación robusta del constructor CloudinaryStorage
// Importamos el objeto completo del módulo
const storageModule = require("multer-storage-cloudinary");
// Accedemos a la propiedad CloudinaryStorage
const CloudinaryStorage = storageModule.CloudinaryStorage;

const app = express();
app.use(cors());
app.use(express.json());

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// Definir cómo se ve una canción en la base de datos
const SongSchema = new mongoose.Schema({
  name: String,
  artist: String,
  uploadedBy: String,
  audio: String,      // URL de Cloudinary
  public_id: String,  // ID para borrarla si hiciera falta
  createdAt: { type: Date, default: Date.now }
});
const Song = mongoose.model("Song", SongSchema);

// --- CONFIGURACIÓN CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Uso del constructor corregido
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "gomusic_uploads",
    resource_type: "auto",
  },
});
const upload = multer({ storage: storage });

// --- ENDPOINTS ---

// 1. Subir Canción
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
    const { name, artist, username } = req.body;

    // Guardar datos en MongoDB
    const newSong = await Song.create({
      name: name || req.file.originalname,
      artist: artist || "Desconocido",
      uploadedBy: username || "Anónimo",
      audio: req.file.path, // Cloudinary nos da esta URL automáticamente
      public_id: req.file.filename
    });

    res.json(newSong);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al subir" });
  }
});

// 2. Listar Canciones
app.get("/songs", async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo canciones" });
  }
});

// 3. Buscar Canciones
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      const all = await Song.find();
      return res.json(all);
    }
    // Búsqueda flexible (insensible a mayúsculas)
    const results = await Song.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { artist: { $regex: query, $options: "i" } }
      ]
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Error buscando" });
  }
});

// --- FRONTEND ---
// Servir la carpeta de compilación (build) de React
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// --- INICIO ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor listo en puerto ${PORT}`));