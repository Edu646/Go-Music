const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* ============================================================
   🔒 PROTECCIÓN GLOBAL ANTI-CRASH (path-to-regexp)
   Evita registrar rutas inválidas como "https://git.new/..."
   Render a veces inyecta rutas así → sin esto Express CRASHEA
=============================================================== */

const isInvalidRoute = (route) =>
  typeof route === "string" && /^https?:\/\//i.test(route);

["use", "get", "post", "put", "delete", "patch", "all"].forEach((method) => {
  const original = app[method].bind(app);

  app[method] = function (route, ...handlers) {
    if (isInvalidRoute(route)) {
      console.error(`⚠️ Omitiendo app.${method}() con ruta inválida:`, route);
      return app;
    }
    try {
      return original(route, ...handlers);
    } catch (err) {
      console.error(`✖ Error registrando ruta "${route}" en ${method}: ${err.message}`);
      return app;
    }
  };
});

/* ============================================================
   🌐 CORS (si no hay ALLOWED_ORIGINS → permite todo)
=============================================================== */

const allowedEnv =
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

if (allowedEnv.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        return allowedEnv.includes(origin)
          ? callback(null, true)
          : callback(new Error("CORS not allowed"));
      },
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    })
  );
  console.log("CORS enabled for:", allowedEnv);
} else {
  app.use(cors());
  console.log("CORS: allowing all origins (ALLOWED_ORIGINS not set)");
}

app.options("*", cors());

/* ============================================================
   🎵 Base de datos de canciones (simulada)
=============================================================== */

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
  { id: 10, name: "Ed Sheeran - Shape Of You (Dj Denis Rublev Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Dj Denis Rublev Remix).mp3" },
  { id: 11, name: "Ed Sheeran - Shape Of You (Holderz Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Holderz Remix).mp3" },
  { id: 12, name: "Ed Sheeran - Shape Of You (Midi Culture Remix)", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Shape Of You (Midi Culture Remix).mp3" },
  { id: 13, name: "Ed Sheeran - Supermarket Flowers", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Supermarket Flowers.mp3" }
];

/* ============================================================
   📁 Servir archivos MP3
=============================================================== */

app.use("/music", express.static(path.join(__dirname, "music")));

/* ============================================================
   🚀 API ENDPOINTS
=============================================================== */

app.get("/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) return res.json([]);
  const results = songs.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q)
  );
  res.json(results);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ============================================================
   🎨 SERVIR FRONTEND (build React)
=============================================================== */

const frontendBuild = path.join(__dirname, "../frontend/gomusic/build");

app.use(express.static(frontendBuild));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuild, "index.html"));
});

/* ============================================================
   🛑 ERROR HANDLER
=============================================================== */

app.use((err, req, res, next) => {
  console.error("Error capturado:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

/* ============================================================
   🚀 INICIAR SERVIDOR
=============================================================== */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
