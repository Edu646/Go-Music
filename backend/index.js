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
// Inicializar Firebase Admin
// =====================
let db = null;
let bucket = null;

try {
  let serviceAccount;

  // Render -> variable FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Local
    const localPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(localPath)) {
      serviceAccount = require(localPath);
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        `${serviceAccount.project_id}.appspot.com`,
    });

    db = admin.firestore();
    bucket = admin.storage().bucket();
    console.log("🔥 Firebase Admin inicializado. Bucket:", bucket.name);
  } else {
    console.warn("⚠ No se encontraron credenciales Firebase");
  }
} catch (err) {
  console.warn("⚠ Error inicializando Firebase:", err.message);
}

// =====================
// Multer (buffer upload)
// =====================
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// SUBIR CANCIONES A FIREBASE STORAGE
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file provided" });

  if (!bucket)
    return res
      .status(500)
      .json({ error: "Firebase Storage no configurado" });

  try {
    const filename = `songs/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(filename);

    const stream = file.createWriteStream({
      metadata: { contentType: req.file.mimetype },
    });

    stream.on("error", (err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    });

    stream.on("finish", async () => {
      try {
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        });

        let docId = null;
        if (db) {
          const doc = await db.collection("songs").add({
            name: req.body.name || req.file.originalname,
            artist: req.body.artist || "",
            audio: url,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          docId = doc.id;
        }

        res.json({
          message: "Canción subida correctamente",
          id: docId,
          url,
        });
      } catch (err) {
        console.error("Error Firestore/URL:", err);
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
// Servir frontend
// =====================
const frontendBuildPath = path.join(
  __dirname,
  "../frontend/gomusic/build"
);

app.use(express.static(frontendBuildPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// =====================
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Servidor funcionando en puerto ${PORT}`)
);
