/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Catálogo local de canciones
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

// Servir archivos de música
app.use("/music", express.static(path.join(__dirname, "music")));

// Endpoint de búsqueda
app.get("/search", (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = songs.filter(
    song => song.name.toLowerCase().includes(q.toLowerCase()) ||
            song.artist.toLowerCase().includes(q.toLowerCase())
  );
  res.json(results);
});

// Mantener el servidor local para desarrollo
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Servidor corriendo en puerto ${port}`));

// Exportar la app como función de Firebase (manteniendo el comportamiento local)
exports.api = onRequest(app);