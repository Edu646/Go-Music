const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin
let db = null;
let bucket = null;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT)
    throw new Error("FIREBASE_SERVICE_ACCOUNT no encontrada");

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  db = admin.firestore();
  bucket = admin.storage().bucket();

  console.log("✅ Firebase Admin inicializado. Bucket:", bucket.name);
} catch (err) {
  console.error("❌ Error inicializando Firebase Admin:", err.message);
}

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint subir canciones
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
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 días
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

      res.json({ message: "Canción subida", id: docId, url });
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error("Error /upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ruta raíz para Render
app.get("/", (req, res) => {
  res.json({ status: "Backend online 🔥" });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
);
