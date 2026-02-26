import express from "express";
import Playlist from "../models/Playlist.js"; // ajusta ruta/nombre

const router = express.Router();

// DELETE /playlists/:id/remove-from-library
router.delete("/playlists/:id/remove-from-library", async (req, res) => {
  try {
    const playlistId = req.params.id;
    const { username } = req.body;

    if (!username) return res.status(400).json({ error: "Falta username" });

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) return res.status(404).json({ error: "Playlist no existe" });

    if (playlist.owner === username) {
      return res.status(400).json({ error: "El owner no puede quitar su propia playlist así" });
    }

    if (!Array.isArray(playlist.sharedWith)) {
      playlist.sharedWith = [];
    }

    const before = playlist.sharedWith.length;

    playlist.sharedWith = playlist.sharedWith.filter((u) => u !== username);

    await playlist.save();

    return res.json({
      ok: true,
      removed: before !== playlist.sharedWith.length,
    });
  } catch (e) {
    console.error("remove-from-library:", e);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
