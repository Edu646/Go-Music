const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const multer = require("multer");

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
    console.log("✅ firebase-admin inicializado. Bucket:", bucket.name);
  } else {
    console.warn("⚠ No se encontraron credenciales de Firebase. Usando catálogo local.");
  }
} catch (err) {
  console.warn("⚠ Error inicializando firebase-admin:", err.message);
}

// =====================
// Multer setup (para subir archivos)
// =====================
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// Endpoint para subir canciones
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  if (!bucket) return res.status(500).json({ error: "Firebase Storage no configurado" });

  const { name, artist } = req.body;

  try {
    const filename = `songs/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(filename);

    const stream = file.createWriteStream({ metadata: { contentType: req.file.mimetype } });

    stream.on("error", err => {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    });

    stream.on("finish", async () => {
      try {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 días
        });

        let docRef = null;
        if (db) {
          docRef = await db.collection("songs").add({
            name: name || req.file.originalname,
            artist: artist || "",
            audio: url,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        res.json({
          message: "Canción subida correctamente",
          id: docRef ? docRef.id : null,
          url,
          name: name || req.file.originalname,
          artist: artist || ""
        });
      } catch (err) {
        console.error("Error generando URL o guardando en Firestore:", err);
        res.status(500).json({ error: err.message });
      }
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error("Error global /upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// Servir frontend React (build)
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));
safeGet("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// =====================
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
