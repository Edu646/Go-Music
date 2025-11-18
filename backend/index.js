const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// ---- START: protección contra rutas que son URLs completas ----
function isFullUrl(route) {
  return typeof route === "string" && /^https?:\/\//i.test(route);
}

const appProto = express.application;
const routerProto = express.Router ? express.Router.prototype : null;

["use", "get", "post", "put", "delete", "patch", "all"].forEach((method) => {
  // parchear app.<method>
  const origAppMethod = appProto[method];
  if (origAppMethod) {
    appProto[method] = function (routeOrHandler, ...handlers) {
      // caso: app.use(handler) -> routeOrHandler no es string
      if (isFullUrl(routeOrHandler)) {
        console.error(`Omitiendo app.${method}() con URL completa (inválida):`, routeOrHandler);
        return this;
      }
      return origAppMethod.call(this, routeOrHandler, ...handlers);
    };
  }

  // parchear router.<method>
  if (routerProto && routerProto[method]) {
    const origRouterMethod = routerProto[method];
    routerProto[method] = function (routeOrHandler, ...handlers) {
      if (isFullUrl(routeOrHandler)) {
        console.error(`Omitiendo router.${method}() con URL completa (inválida):`, routeOrHandler);
        return this;
      }
      return origRouterMethod.call(this, routeOrHandler, ...handlers);
    };
  }
});
// ---- END: protección contra rutas que son URLs completas ----

const app = express();

// Asegura CORS para tu frontend en producción (lee ALLOWED_ORIGINS env) o permite todo si no está definido
const allowedEnv = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
if (allowedEnv.length) {
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return allowedEnv.includes(origin) ? callback(null, true) : callback(new Error("CORS not allowed"));
    },
    methods: ["GET","POST","OPTIONS"],
    credentials: true
  }));
  console.log("CORS enabled for:", allowedEnv);
} else {
  app.use(cors()); // permite todos (útil para desarrollo)
  console.log("CORS: allowing all origins (ALLOWED_ORIGINS not set)");
}
app.options("*", cors());

// Helper seguro para registrar rutas (evita que una ruta malformada detenga el arranque)
function safeGet(routePath, handler) {
  try {
    app.get(routePath, handler);
  } catch (err) {
    console.error(`✖ Ruta inválida registrada: "${routePath}" -> ${err.message}`);
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
// Servir música (desde backend/music para desarrollo local)
// En Render/producción puedes mover los MP3 a public/music en la raíz del repo y servirlos con /music/<file>
app.use("/music", express.static(path.join(__dirname, "music")));

// =====================
// Endpoints API (namespaced bajo /api para evitar colisiones)
// =====================
safeGet("/search", (req, res) => {
  const q = (req.query.q || "").toString().trim().toLowerCase();
  if (!q) return res.json([]);
  const results = songs.filter(
    song => song.name.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
  );
  res.json(results);
});

safeGet("/api/health", (req, res) => res.json({ status: "ok" }));

// =====================
// Servir frontend React (BUILD)
// Ajusta la ruta si tu build está en otra carpeta
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
try {
  app.use(express.static(frontendBuildPath));
  // React Router fallback
  safeGet("*", (req, res) => {
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  });
} catch (err) {
  console.warn("⚠ No se encontró build del frontend en:", frontendBuildPath);
  console.warn("   Si despliegas en Render asegúrate de construir el frontend antes o de servirlo desde la carpeta correcta.");
}

// =====================
// Mostrar rutas registradas (útil para depuración en Render)
// =====================
function listRoutes() {
  try {
    const routes = [];
    app._router.stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        routes.push({ path: layer.route.path, methods });
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        layer.handle.stack.forEach(l => {
          if (l.route && l.route.path) {
            const methods = Object.keys(l.route.methods).join(",").toUpperCase();
            routes.push({ path: l.route.path, methods });
          }
        });
      }
    });
    console.log("Rutas registradas:", routes);
  } catch (err) {
    console.error("No se pudo listar rutas:", err.message);
  }
}
listRoutes();

// =====================
// Error handler (al final)
// =====================
app.use((err, req, res, next) => {
  console.error("Error capturado por middleware:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// =====================
// Iniciar servidor (Render usa app.listen normalmente)
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));