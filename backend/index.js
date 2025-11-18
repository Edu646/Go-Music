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
// Helper seguro para registrar rutas
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
    console.warn("⚠ No se encontraron credenciales de Firebase. Se usará registro local.");
  }
} catch (err) {
  console.warn("⚠ Error inicializando firebase-admin:", err.message);
}

// =====================
// Multer setup (subida de archivos en memoria)
// =====================
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// Endpoint /upload
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Validaciones básicas
    if (!req.file) return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });
    const { name, artist, username } = req.body;
    if (!username) return res.status(400).json({ error: "Se requiere el nombre de usuario" });

    const filename = `songs/${Date.now()}_${req.file.originalname}`;
    let audioUrl = null;

    // Intentar subir a Firebase Storage
    if (bucket) {
      try {
        const file = bucket.file(filename);
        const stream = file.createWriteStream({
          metadata: { contentType: req.file.mimetype }
        });

        await new Promise((resolve, reject) => {
          stream.on("error", reject);
          stream.on("finish", resolve);
          stream.end(req.file.buffer);
        });

        const [url] = await bucket.file(filename).getSignedUrl({
          action: "read",
          expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 días
        });
        audioUrl = url;
      } catch (err) {
        console.warn("⚠ No se pudo subir a Firebase Storage, se seguirá con registro local:", err.message);
      }
    } else {
      console.warn("⚠ Bucket de Firebase no configurado, se seguirá con registro local");
    }

    // Guardar en Firestore
    let docRef = null;
    if (db) {
      try {
        docRef = await db.collection("songs").add({
          name: name || req.file.originalname,
          artist: artist || "",
          uploadedBy: username,
          audio: audioUrl || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.warn("⚠ No se pudo guardar en Firestore, guardando localmente:", err.message);
        // Guardar localmente
        const localPath = path.join(__dirname, "local_songs.json");
        let localSongs = [];
        if (fs.existsSync(localPath)) {
          localSongs = JSON.parse(fs.readFileSync(localPath, "utf-8"));
        }
        localSongs.push({
          name: name || req.file.originalname,
          artist: artist || "",
          uploadedBy: username,
          audio: audioUrl || "",
          createdAt: new Date().toISOString()
        });
        fs.writeFileSync(localPath, JSON.stringify(localSongs, null, 2));
      }
    }

    // Respuesta exitosa
    res.json({
      message: "Canción registrada correctamente",
      id: docRef ? docRef.id : null,
      url: audioUrl || null,
      name: name || req.file.originalname,
      artist: artist || "",
      uploadedBy: username
    });

  } catch (err) {
    console.error("Error global /upload:", err);
    res.json({
      message: "Error manejado al subir la canción, pero registro local guardado",
      error: err.message
    });
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
