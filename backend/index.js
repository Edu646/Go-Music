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
// Funciones auxiliares
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
// ENDPOINTS API
// ---------------------

// 1. Subir canciones
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });

    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    const timestamp = Date.now();
    // Limpiamos el nombre del archivo para evitar errores
    const safeName = req.file.originalname.replace(/[^a-z0-9.]/gi, '_');
    const fileName = `${timestamp}_${safeName}`;
    
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const uploadPath = path.join(uploadDir, fileName);
    fs.writeFileSync(uploadPath, req.file.buffer);

    const url = `/uploads/${fileName}`;

    const songData = {
      id: timestamp, // Añadimos ID único
      name: name || req.file.originalname,
      artist: artist || "Desconocido",
      uploadedBy: username,
      audio: url,
      createdAt: new Date().toISOString()
    };
    saveSong(songData);

    res.json({ message: "Canción subida correctamente", ...songData });
  } catch (err) {
    console.error("Error subiendo canción:", err);
    res.status(500).json({ error: "Error interno", detalles: err.message });
  }
});

// 2. Listar todas las canciones
app.get("/songs", (req, res) => {
  const songs = readSongs();
  res.json(songs);
});

// 3. Buscar canciones (ESTE ES EL QUE FALTABA)
app.get("/search", (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : "";
  const songs = readSongs();

  if (!query) {
    // Si no hay búsqueda, devolvemos todo o nada (según prefieras)
    return res.json(songs);
  }

  const results = songs.filter(song => {
    const songName = song.name ? song.name.toLowerCase() : "";
    const songArtist = song.artist ? song.artist.toLowerCase() : "";
    return songName.includes(query) || songArtist.includes(query);
  });

  res.json(results);
});

// ---------------------
// Servir archivos estáticos y Frontend
// ---------------------

// Servir audios subidos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Servir el frontend compilado
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));

// Catch-all para React (usando RegExp para evitar el error de Express 5)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// ---------------------
// Iniciar servidor
// ---------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));