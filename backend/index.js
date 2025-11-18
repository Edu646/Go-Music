const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Multer: subir archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Archivo JSON para guardar las canciones
const DATA_FILE = path.join(__dirname, "songs.json");

// ---------------------
// Funciones para leer y guardar canciones
// ---------------------
function readSongs() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (err) {
    console.error("Error leyendo songs.json:", err);
    return [];
  }
}

function saveSong(song) {
  const songs = readSongs();
  songs.push(song);
  fs.writeFileSync(DATA_FILE, JSON.stringify(songs, null, 2));
}

// ---------------------
// Endpoint para subir canciones
// ---------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });

    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    // Guardar archivo en carpeta uploads
    const timestamp = Date.now();
    const fileName = `${timestamp}_${req.file.originalname}`;
    const uploadDir = path.join(__dirname, "uploads");

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const uploadPath = path.join(uploadDir, fileName);
    fs.writeFileSync(uploadPath, req.file.buffer);

    // URL relativa accesible desde frontend
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

    res.json({ message: "Canción subida correctamente", ...songData });
  } catch (err) {
    console.error("Error subiendo canción:", err);
    res.status(500).json({ error: "Error subiendo la canción", detalles: err.message });
  }
});

// ---------------------
// Endpoint para listar canciones
// ---------------------
app.get("/songs", (req, res) => {
  const songs = readSongs();
  res.json(songs);
});

// ---------------------
// Servir archivos subidos
// ---------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------
// Servir frontend React
// ---------------------
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// ---------------------
// Iniciar servidor
// ---------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
