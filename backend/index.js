const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Helper seguro para registrar rutas
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
  { id: 2, name: "Castle on the Hill", artist: "Ed Sheeran", audio: "/music/Ed-Sheeran-Castle-on-the-Hill.mp3" },
  { id: 3, name: "Perfect", artist: "Ed Sheeran", audio: "/music/Ed Sheeran - Perfect.mp3" }
  // ... agrega más si quieres
];

// =====================
// Inicializar Firebase Admin
// =====================
let db = null;
let bucket = null;

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
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
// Servir música local
// =====================
app.use("/music", express.static(path.join(__dirname, "music")));

// =====================
// Endpoints API
// =====================

// /search
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
      const results = songs.filter(song => song.name.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q));
      return res.json(results);
    }
  } catch (err) {
    console.error("Error en /search:", err);
    return res.status(500).json({ error: err.message });
  }
});

// /songs GET
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

// /songs POST
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
      const newItem = { id: songs.length + 1, name, artist: artist || "", audio };
      songs.push(newItem);
      return res.json({ id: newItem.id });
    }
  } catch (err) {
    console.error("Error en POST /songs:", err);
    return res.status(500).json({ error: err.message });
  }
});

// /upload
try {
  const multer = require("multer");
  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    if (!bucket) return res.status(500).json({ error: "Firebase Storage no está configurado" });

    try {
      const filename = `songs/${Date.now()}_${req.file.originalname}`;
      const file = bucket.file(filename);
      const stream = file.createWriteStream({ metadata: { contentType: req.file.mimetype } });

      stream.on("error", err => res.status(500).json({ error: err.message }));

      stream.on("finish", async () => {
        try {
          const [url] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 1000 * 60 * 60 * 24 * 7
          });
          return res.json({ url });
        } catch (err) {
          return res.status(500).json({ error: err.message });
        }
      });

      stream.end(req.file.buffer);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
} catch (err) {
  console.warn("⚠ Endpoint /upload no fue activado. Instala multer si lo deseas.");
}

// =====================
// Servir frontend React
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
try {
  app.use(express.static(frontendBuildPath));
  safeGet("*", (req, res) => res.sendFile(path.join(frontendBuildPath, "index.html")));
} catch (err) {
  console.warn("⚠ No se encontró build del frontend en:", frontendBuildPath);
}

// =====================
// Listar rutas de forma segura
// =====================
function listRoutes() {
  try {
    if (!app._router) {
      console.warn("⚠ app._router no está definido, no se pueden listar rutas.");
      return;
    }

    const routes = [];
    app._router.stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
        routes.push({ path: layer.route.path, methods });
      }
    });
    console.log("Rutas registradas:", routes);
  } catch (err) {
    console.error("No se pudo listar rutas:", err.message);
  }
}
listRoutes();

// =====================
// Error handler
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
