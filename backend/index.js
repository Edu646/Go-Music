// ...existing code...
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// ===== CORS =====
// Si defines ALLOWED_ORIGINS en Render (coma-separados) se usará la lista.
// Si no está definido se permiten todos los orígenes (útil para desarrollo).
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || ""; // p. ej. "https://go-music-3mgo.onrender.com,https://tu-backend.onrender.com"
const allowedOrigins = allowedOriginsEnv.split(",").map(s => s.trim()).filter(Boolean);

if (allowedOrigins.length === 0) {
  app.use(cors()); // permite todo
  console.log("CORS: se permiten todos los orígenes (ALLOWED_ORIGINS no definido)");
} else {
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // tools/server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS: origen no permitido"));
    },
    methods: ["GET","POST","OPTIONS"],
    credentials: true
  }));
  console.log("CORS habilitado para:", allowedOrigins);
}

// permitir preflight en todas las rutas
app.options("*", cors());

app.use(express.json());

// Helper seguro para registrar rutas (no borra nada existente)
function safeGet(routePath, handler) {
  if (typeof routePath !== "string") {
    console.error("Ruta no es string, omitiendo:", routePath);
    return;
  }
  // Evitar registrar rutas que sean URLs completas (provocan path-to-regexp error)
  if (/^https?:\/\//i.test(routePath)) {
    console.error(`Ruta inválida (URL completa) detectada y omitida: "${routePath}"`);
    return;
  }
  try {
    app.get(routePath, handler);
  } catch (err) {
    console.error(`Error al registrar ruta "${routePath}": ${err.message}`);
  }
}

// =====================
// Catálogo de canciones
// =====================
const songs = [
  { id: 1, name: "Shape of You", artist: "Ed Sheeran", audio: "/music/Shape-Of-You.mp3" },
  { id: 2, name: "Ed Sheeran - Castle on the Hill", artist: "Ed Sheeran", audio: "/music/Ed-Sheeran-Castle-on-the-Hill.mp3" },
  { id: 3, name: "Ed Sheeran - Don't", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Don't.mp3" },
  { id: 4, name: "Ed Sheeran - Hearts Don't Break Around Here", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Hearts Don't Break Around Here.mp3" },
  { id: 5, name: "Ed Sheeran - How Would You Feel (Paean)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - How Would You Feel (Paean).mp3" },
  { id: 6, name: "Ed Sheeran - Nancy Mulligan", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Nancy Mulligan.mp3" },
  { id: 7, name: "Ed Sheeran - New Man", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - New Man.mp3" },
  { id: 8, name: "Ed Sheeran - Perfect", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Perfect.mp3" },
  { id: 9, name: "Ed Sheeran - Photograph (Felix Jaehn Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Photograph (Felix Jaehn Remix).mp3" },
  { id: 10, name: "Ed Sheeran - Shape Of You (Dj Denis Rublev & Dj Anton remix) Cmp3.eu", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Dj Denis Rublev & Dj Anton remix) Cmp3.eu.mp3" },
  { id: 11, name: "Ed Sheeran - Shape Of You (Holderz Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Holderz Remix).mp3" },
  { id: 12, name: "Ed Sheeran - Shape Of You (Midi Culture Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Midi Culture Remix).mp3" },
  { id: 13, name: "Ed Sheeran - Supermarket Flowers", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Supermarket Flowers.mp3" }
];

// =====================
// Servir música (desarrollo: backend/music)
// En producción con monorepo en Render puedes colocar MP3 en backend/music o en public/ del frontend.
// =====================
const musicDir = path.join(__dirname, "music");
if (fs.existsSync(musicDir)) {
  app.use("/music", express.static(musicDir));
  console.log("Servir música desde:", musicDir);
} else {
  console.warn("Carpeta de música no encontrada en:", musicDir);
}

// =====================
// Endpoints API
// =====================
// Búsqueda de canciones
safeGet("/api/search", (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim().toLowerCase();
    if (!q) return res.json([]);
    const results = songs.filter(
      song => song.name.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
    );
    res.json(results);
  } catch (err) {
    console.error("Error en /api/search:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Ruta de salud
safeGet("/api/health", (req, res) => res.json({ status: "ok" }));

// =====================
// Servir frontend React (si existe build)
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // fallback para SPA (React Router)
  safeGet("*", (req, res) => {
    const indexFile = path.join(frontendBuildPath, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return res.status(404).send("No se encontró index.html del frontend");
  });
  console.log("Frontend servido desde:", frontendBuildPath);
} else {
  console.warn("Build del frontend no encontrado en:", frontendBuildPath);
  console.warn("Si quieres servir el frontend desde este backend, construye el frontend (npm run build) y colócalo en esa ruta.");
}

// =====================
// Listar rutas registradas (depuración)
// =====================
function listRoutes() {
  try {
    const routes = [];
    if (app._router && app._router.stack) {
      app._router.stack.forEach(layer => {
        if (layer.route && layer.route.path) {
          const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
          routes.push({ path: layer.route.path, methods });
        }
      });
    }
    console.log("Rutas registradas:", routes);
  } catch (err) {
    console.error("No se pudo listar rutas:", err.message);
  }
}
listRoutes();

// =====================
// Handler de errores (al final)
// =====================
app.use((err, req, res, next) => {
  console.error("Error capturado por middleware:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// =====================
// Iniciar servidor (Render usa app.listen)
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
// ...existing code...