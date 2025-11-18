// backend/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// Multer para recibir archivos
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// Inicializar Firebase Admin
// =====================
let bucket = null;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    const localPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(localPath)) serviceAccount = require(localPath);
  }

  if (!serviceAccount) throw new Error("No se encontró serviceAccountKey.json ni variable FIREBASE_SERVICE_ACCOUNT");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
  });

  bucket = admin.storage().bucket();
  console.log("✅ Firebase Admin inicializado, bucket:", bucket.name);
} catch (err) {
  console.error("❌ Error inicializando Firebase Admin:", err.message);
}

// =====================
// Endpoint para subir canciones a Firebase Storage
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    if (!bucket) return res.status(500).json({ error: "Firebase Storage no está configurado" });

    const { name, artist } = req.body;
    if (!name) return res.status(400).json({ error: "Falta nombre de canción" });

    const filename = `songs/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(filename);

    const stream = file.createWriteStream({
      metadata: { contentType: req.file.mimetype },
    });

    stream.on("error", (err) => {
      console.error("Error subiendo a Storage:", err);
      res.status(500).json({ error: err.message });
    });

    stream.on("finish", async () => {
      try {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 año
        });

        // Guardar metadata en Firestore
        const docRef = await admin.firestore().collection("songs").add({
          name,
          artist: artist || "",
          audio: url,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ id: docRef.id, url });
      } catch (err) {
        console.error("Error generando URL o guardando en Firestore:", err);
        res.status(500).json({ error: err.message });
      }
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error("Error general en /upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// =====================
// Servir frontend React (opcional)
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));
app.get("*", (req, res) => res.sendFile(path.join(frontendBuildPath, "index.html")));

// =====================
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
