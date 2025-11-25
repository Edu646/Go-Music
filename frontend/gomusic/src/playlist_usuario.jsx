import React, { useState, useEffect } from "react";
import "./playlist_usuario.css";

export default function UserPlaylists({ user }) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null); // playlist seleccionada para editar
  const [allSongs, setAllSongs] = useState([]);
  const [search, setSearch] = useState("");

  // Cargar playlists del usuario
  const fetchPlaylists = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setPlaylists(data);
    } catch (err) {
      console.error("Error cargando playlists:", err);
    }
  };

  // Cargar todas las canciones de la DB (para agregar)
  const fetchSongs = async () => {
    try {
      const query = search ? `/search?q=${search}` : "/songs";
      const res = await fetch(query);
      const data = await res.json();
      setAllSongs(data);
    } catch (err) {
      console.error("Error cargando canciones:", err);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchSongs();
  }, [user, search]);

  // Agregar canción a playlist
  const addSong = async (playlistId, song) => {
    try {
      const res = await fetch(`/playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song }),
      });
      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error agregando canción:", err);
    }
  };

  // Quitar canción de playlist
  const removeSong = async (playlistId, songId) => {
    try {
      const playlist = playlists.find(p => p._id === playlistId);
      if (!playlist) return;
      const updatedSongs = playlist.songs.filter(s => s._id !== songId);
      const res = await fetch(`/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: updatedSongs.map(s => s._id) }),
      });
      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error quitando canción:", err);
    }
  };

  if (!user) return <p>Debes iniciar sesión para ver tus playlists.</p>;

  return (
    <div className="user-playlists">
      <h2>Mis Playlists</h2>
      <div className="playlist-grid">
        {playlists.map((p) => (
          <div key={p._id} className="playlist-card">
            <img
              src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"}
              alt={p.name}
            />
            <h4>{p.name}</h4>
            <p>{p.songs.length} canciones</p>
            <button onClick={() => setSelected(p)}>Editar</button>
          </div>
        ))}
      </div>

      {/* Editor de playlist */}
      {selected && (
        <div className="playlist-editor">
          <h3>Editando: {selected.name}</h3>
          <button onClick={() => setSelected(null)}>Cerrar Editor</button>

          {/* Buscar canciones para agregar */}
          <input
            type="text"
            placeholder="Buscar canciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <h4>Agregar canciones:</h4>
          <ul>
            {allSongs.map((s) => (
              <li key={s._id}>
                {s.name} - {s.artist}
                <audio src={s.audio} controls style={{ marginLeft: "10px" }} />
                {!selected.songs.find(song => song._id === s._id) && (
                  <button onClick={() => addSong(selected._id, s)}>Agregar</button>
                )}
              </li>
            ))}
          </ul>

          <h4>Canciones actuales:</h4>
          <ul>
            {selected.songs.map((s) => (
              <li key={s._id}>
                {s.name} - {s.artist}
                <audio src={s.audio} controls style={{ marginLeft: "10px" }} />
                <button onClick={() => removeSong(selected._id, s._id)}>Quitar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
