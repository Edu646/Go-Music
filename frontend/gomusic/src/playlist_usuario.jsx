import React, { useState, useEffect } from "react";

export default function UserPlaylists({ user }) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [songs, setSongs] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistImage, setNewPlaylistImage] = useState(null);

  // Cargar playlists del usuario
  const loadPlaylists = async () => {
    if (!user?.username) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setPlaylists(data);
    } catch (err) {
      console.error("Error cargando playlists:", err);
    }
  };

  // Crear nueva playlist
  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return alert("Ingresa un nombre");
    try {
      const formData = new FormData();
      formData.append("name", newPlaylistName);
      formData.append("owner", user.username);
      if (newPlaylistImage) formData.append("image", newPlaylistImage);

      const res = await fetch("/playlists", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error("Error creando playlist");

      setNewPlaylistName("");
      setNewPlaylistImage(null);
      loadPlaylists();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear la playlist");
    }
  };

  // Buscar canciones
  const searchSongs = async () => {
    if (!search.trim()) return;
    try {
      const res = await fetch(`/search?q=${search}`);
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      console.error("Error buscando canciones:", err);
    }
  };

  // Agregar canción a playlist
  const addToPlaylist = async (playlistId, song) => {
    try {
      const res = await fetch(`/playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song })
      });
      if (!res.ok) throw new Error("Error agregando canción");
      loadPlaylists(); // refrescar
    } catch (err) {
      console.error(err);
      alert("No se pudo agregar la canción");
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, [user]);

  if (!user) return <p>Debes iniciar sesión para ver tus playlists.</p>;

  return (
    <div className="user-playlists">
      <h2>Mis Playlists</h2>

      {/* Crear nueva playlist */}
      <div className="new-playlist">
        <input
          type="text"
          placeholder="Nombre de la playlist"
          value={newPlaylistName}
          onChange={e => setNewPlaylistName(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          onChange={e => setNewPlaylistImage(e.target.files[0])}
        />
        <button onClick={createPlaylist}>Crear Playlist</button>
      </div>

      {/* Lista de playlists */}
      <div className="playlist-grid">
        {playlists.map(p => (
          <div
            key={p._id}
            className={`playlist-card ${selected?._id === p._id ? "selected" : ""}`}
            onClick={() => setSelected(p)}
          >
            <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
            <h4>{p.name}</h4>
            <p>{p.songs.length} canciones</p>
          </div>
        ))}
      </div>

      {/* Editor de playlist */}
      {selected && (
        <div className="playlist-editor">
          <h3>Editando: {selected.name}</h3>

          <input
            type="text"
            placeholder="Buscar canciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={searchSongs}>Buscar</button>

          <ul>
            {songs.map(s => (
              <li key={s._id}>
                {s.name} - {s.artist}
                <button onClick={() => addToPlaylist(selected._id, s)}>Agregar</button>
              </li>
            ))}
          </ul>

          <h4>Canciones de la playlist:</h4>
          <ul>
            {selected.songs.map(s => (
              <li key={s._id}>{s.name} - {s.artist}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
