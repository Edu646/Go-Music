const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Helper seguro para registrar rutas (evita que una ruta malformada detenga el arranque)
function safeGet(routePath, handler) {
  try {
    app.get(routePath, handler);
  } catch (err) {
    console.error(`✖ Ruta inválida registrada: "${routePath}" -> ${err.message}`);
  }
}

// =====================
// Catálogo local de canciones (fallback para desarrollo)
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
// Inicializar Firebase Admin (intenta desde env o archivo local para desarrollo)
// Variables de entorno recomendadas:
//   FIREBASE_SERVICE_ACCOUNT  -> JSON stringificado del service account
//   FIREBASE_STORAGE_BUCKET   -> e.g. "mi-proyecto.appspot.com"
// =====================
let db = null;
let bucket = null;

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // archivo local opcional para desarrollo: backend/serviceAccountKey.json
    const localPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
    });
    db = admin.firestore();
    bucket = admin.storage().bucket();
    console.log("✅ firebase-admin inicializado.");
  } else {
    console.warn("⚠ No se encontraron credenciales de Firebase. Usando catálogo local.");
  }
} catch (err) {
  console.warn("⚠ Error inicializando firebase-admin:", err.message);
}

// =====================
// Servir música local (solo para desarrollo si mantienes la carpeta /music)
// En producción usa URLs de Firebase Storage (HTTPS) para evitar Mixed Content.
// =====================
app.use("/music", express.static(path.join(__dirname, "music")));

// =====================
// Endpoints API (namespaced bajo /api opcional, aquí quedan en raíz para compatibilidad)
// =====================

// Búsqueda: si Firestore está disponible, busca en la colección "songs", si no, usa el array local
safeGet("/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim().toLowerCase();
  if (!q) return res.json([]);

  try {
    if (db) {
      const snapshot = await db.collection("songs").get();
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(s => ((s.name || "").toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q)));
      return res.json(results);
    } else {
      const results = songs.filter(
        song => song.name.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)
      );
      return res.json(results);
    }
  } catch (err) {
    console.error("Error en /search:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Listar todas las canciones (Firestore o local)
safeGet("/songs", async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection("songs").orderBy("createdAt", "desc").get();
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.json(list);
    } else {
      return res.json(songs);
    }
  } catch (err) {
    console.error("Error en /songs:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Crear metadata de canción (por ejemplo después de subir a Storage desde frontend)
app.post("/songs", async (req, res) => {
  try {
    const { name, artist, audio } = req.body;
    if (!name || !audio) return res.status(400).json({ error: "Faltan campos: name y audio son obligatorios" });

    if (db) {
      const docRef = await db.collection("songs").add({
        name,
        artist: artist || "",
        audio,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.json({ id: docRef.id });
    } else {
      // fallback local: insertar en array (no persistente)
      const newItem = { id: songs.length + 1, name, artist: artist || "", audio };
      songs.push(newItem);
      return res.json({ id: newItem.id });
    }
  } catch (err) {
    console.error("Error en POST /songs:", err);
    return res.status(500).json({ error: err.message });
  }
});

// (Opcional) Endpoint para subir archivos vía backend a Firebase Storage
// Usa multipart/form-data con campo 'file'.
// Nota: requiere instalar multer (npm install multer) y solo funciona si bucket está disponible.
try {
  const multer = require("multer");
  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    if (!bucket) return res.status(500).json({ error: "Firebase Storage no está configurado" });

    try {
      const filename = `songs/${Date.now()}_${req.file.originalname}`;
      const file = bucket.file(filename);
      const stream = file.createWriteStream({
        metadata: { contentType: req.file.mimetype }
      });

      stream.on("error", err => {
        console.error("Upload error:", err);
        return res.status(500).json({ error: err.message });
      });

      stream.on("finish", async () => {
        // Hacer público o generar URL firmada según reglas del bucket
        // Aquí se genera una URL de descarga pública (si el bucket lo permite) usando getSignedUrl
        try {
          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 días
          });
          return res.json({ url });
        } catch (err) {
          console.error("Error generando URL:", err);
          return res.status(500).json({ error: err.message });
        }
      });

      stream.end(req.file.buffer);
    } catch (err) {
      console.error("Error en /upload:", err);
      return res.status(500).json({ error: err.message });
    }
  });
} catch (err) {
  // multer no está instalado o error; omitimos endpoint /upload
  console.warn("⚠ Endpoint /upload no fue activado. Instala multer si lo deseas. Detalle:", err.message);
}

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
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));