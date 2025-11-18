const express = require("express");
const cors = require("cors");
const path = require("path");
const admin = require("firebase-admin");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let db = null;
let bucket = null;

// =====================
// Inicializar Firebase Admin
// =====================
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("No se encontró FIREBASE_SERVICE_ACCOUNT");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
  });

  db = admin.firestore();
  bucket = admin.storage().bucket();

  console.log("✅ Firebase inicializado correctamente");
  console.log("Bucket:", bucket.name);

} catch (err) {
  console.error("❌ Error inicializando Firebase:", err.message);
  process.exit(1); // Detener backend si Firebase no funciona
}

// =====================
// Endpoint /upload
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });
    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    const timestamp = Date.now();
    const filename = `songs/${timestamp}_${req.file.originalname}`;
    const file = bucket.file(filename);

    console.log("Subiendo archivo:", filename);

    // Subida a Firebase Storage
    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
      public: true, // URL pública
      resumable: false
    });

    const audioUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log("Archivo subido correctamente. URL:", audioUrl);

    // Guardar en Firestore
    const docRef = await db.collection("songs").add({
      name: name || req.file.originalname,
      artist: artist || "",
      uploadedBy: username,
      audio: audioUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      message: "Canción subida correctamente",
      id: docRef.id,
      url: audioUrl,
      name: name || req.file.originalname,
      artist: artist || "",
      uploadedBy: username
    });

  } catch (err) {
    console.error("Error subiendo canción:", err);
    res.status(500).json({
      error: "No se pudo subir la canción a Firebase. Revisa credenciales y bucket.",
      detalles: err.message
    });
  }
});

// =====================
// Servir frontend React
// =====================
const frontendBuildPath = path.join(__dirname, "../frontend/gomusic/build");
app.use(express.static(frontendBuildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// =====================
// Iniciar servidor
// =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
