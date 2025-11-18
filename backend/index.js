const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const DATA_FILE = path.join(__dirname, "songs.json");

// =====================
// Leer canciones existentes
// =====================
function readSongs() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (err) {
    console.error("Error leyendo songs.json:", err);
    return [];
  }
}

// =====================
// Guardar canciones
// =====================
function saveSong(song) {
  const songs = readSongs();
  songs.push(song);
  fs.writeFileSync(DATA_FILE, JSON.stringify(songs, null, 2));
}

// =====================
// Endpoint /upload
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });

    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    // Guardar archivo en "storage" local dentro del proyecto
    const timestamp = Date.now();
    const fileName = `${timestamp}_${req.file.originalname}`;
    const uploadPath = path.join(__dirname, "uploads", fileName);

    // Crear carpeta uploads si no existe
    if (!fs.existsSync(path.join(__dirname, "uploads"))) {
      fs.mkdirSync(path.join(__dirname, "uploads"));
    }

    fs.writeFileSync(uploadPath, req.file.buffer);

    // Crear URL accesible desde Render (ruta /uploads)
    const url = `/uploads/${fileName}`;

    // Guardar datos en JSON
    const songData = {
      name: name || req.file.originalname,
      artist: artist || "",
      uploadedBy: username,
      audio: url,
      createdAt: new Date().toISOString()
    };
    saveSong(songData);

    res.json({
      message: "Canción subida correctamente",
      url,
      ...songData
    });

  } catch (err) {
    console.error("Error subiendo canción:", err);
    res.status(500).json({ error: "Error subiendo la canción", detalles: err.message });
  }
});

// =====================
// Servir archivos estáticos (uploads y frontend React)
// =====================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// =====================
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
