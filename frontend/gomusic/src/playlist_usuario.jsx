import React, { useEffect, useState } from "react";

export default function UserPlaylists({ user }) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null); // ID o playlist seleccionada
  const [search, setSearch] = useState("");
  const [songs, setSongs] = useState([]);

  const loadPlaylists = async () => {
    if (!user) return; // <-- Evitar error si user es undefined
    const res = await fetch(`/playlists/${user.username}`);
    const data = await res.json();
    setPlaylists(data);
  };

  const searchSongs = async () => {
    if (!search.trim()) return;
    const res = await fetch(`/search?q=${search}`);
    const data = await res.json();
    setSongs(data);
  };

  const addToPlaylist = async (playlistId, song) => {
    const res = await fetch(`/playlists/${playlistId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song })
    });

    if (res.ok) loadPlaylists();
  };

  // Carga playlists solo cuando user existe
  useEffect(() => {
    if (user) loadPlaylists();
  }, [user]);

  if (!user) return <p>Debes iniciar sesión para ver tus playlists.</p>;

  return (
    <div className="user-playlists">
      <h2>Mis Playlists</h2>

      {/* Lista de playlists */}
      <div className="playlist-grid">
        {playlists.map(p => (
          <div key={p._id} className="playlist-card" onClick={() => setSelected(p)}>
            <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} />
            <h4>{p.name}</h4>
            <p>{p.songs.length} canciones</p>
          </div>
        ))}
      </div>

      {/* Editor */}
      {selected && (
        <div className="playlist-editor">
          <h3>Editando: {selected.name}</h3>

          <input
            type="text"
            placeholder="Buscar canciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              <li key={s.id}>{s.name} - {s.artist}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
