// =====================
// Importar dependencias
// =====================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// Helper seguro para rutas
// =====================
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
    console.warn("⚠ No se encontraron credenciales de Firebase. No se podrá subir a Storage.");
  }
} catch (err) {
  console.warn("⚠ Error inicializando firebase-admin:", err.message);
}

// =====================
// Multer (subida en memoria)
// =====================
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// Endpoint para subir canciones
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });
    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    if (!bucket) return res.status(500).json({ error: "Firebase Storage no configurado" });

    const timestamp = Date.now();
    const filename = `songs/${timestamp}_${req.file.originalname}`;
    const file = bucket.file(filename);

    // Subida a Firebase Storage
    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
      public: true, // para que la URL sea accesible públicamente
      resumable: false
    });

    // Generar URL pública
    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    // Guardar en Firestore
    let docRef = null;
    if (db) {
      docRef = await db.collection("songs").add({
        name: name || req.file.originalname,
        artist: artist || "",
        uploadedBy: username,
        audio: audioUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Responder al frontend
    res.json({
      message: "Canción subida correctamente",
      id: docRef ? docRef.id : null,
      url: audioUrl,
      name: name || req.file.originalname,
      artist: artist || "",
      uploadedBy: username
    });
  } catch (err) {
    console.error("Error subiendo canción:", err);
    res.status(500).json({ error: "Error subiendo la canción: " + err.message });
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
