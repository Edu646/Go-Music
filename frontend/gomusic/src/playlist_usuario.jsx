import React, { useState, useEffect } from "react";
import { usePlayer } from "./PlayerContext";
import "./playlist_usuario.css";

export default function UserPlaylists() {
  const [user, setUser] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null); // Playlist seleccionada para editar
  const [allSongs, setAllSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [popupPlaylist, setPopupPlaylist] = useState(null); // Popup de reproducción

  const { play } = usePlayer();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Obtener usuario de localStorage
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("gomusic_user"));
    if (storedUser) setUser(storedUser);
  }, []);

  // Fetch playlists
  const fetchPlaylists = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setPlaylists(data);
      if (selected) {
        const updated = data.find(p => p._id === selected._id);
        setSelected(updated || null);
      }
    } catch (err) {
      console.error("Error cargando playlists:", err);
    }
  };

  // Fetch songs
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

  const removeSong = async (playlistId, songId) => {
    try {
      const playlist = playlists.find(p => p._id === playlistId);
      if (!playlist) return;
      const updatedSongs = playlist.songs.filter(
        s => s._id.toString() !== songId.toString()
      );
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

  const openPopup = (playlist) => {
    setPopupPlaylist(playlist);
    setCurrentIndex(0);
    if (playlist.songs[0]) play(playlist.songs[0]);
  };

  const closePopup = () => setPopupPlaylist(null);

  const nextSong = () => {
    if (!popupPlaylist) return;
    const nextIndex = (currentIndex + 1) % popupPlaylist.songs.length;
    setCurrentIndex(nextIndex);
    play(popupPlaylist.songs[nextIndex]);
  };

  const prevSong = () => {
    if (!popupPlaylist) return;
    const prevIndex = (currentIndex - 1 + popupPlaylist.songs.length) % popupPlaylist.songs.length;
    setCurrentIndex(prevIndex);
    play(popupPlaylist.songs[prevIndex]);
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
              onClick={() => openPopup(p)}
              style={{ cursor: "pointer" }}
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
                {!selected.songs.some(song => song._id.toString() === s._id.toString()) && (
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
                <button onClick={() => removeSong(selected._id, s._id)}>Quitar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Popup de reproducción */}
      {popupPlaylist && (
        <div className="playlist-popup">
          <div className="popup-content">
            <button className="close-popup" onClick={closePopup}>X</button>
            <img src={popupPlaylist.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={popupPlaylist.name} />
            <h3>{popupPlaylist.name}</h3>

            <ul className="popup-song-list">
              {popupPlaylist.songs.map((s, i) => (
                <li key={s._id}>
                  {s.name} - {s.artist}
                  <button onClick={() => { setCurrentIndex(i); play(s); }}>Play</button>
                </li>
              ))}
            </ul>

            <div className="popup-controls">
              <button onClick={prevSong}>⏮️</button>
              <button onClick={nextSong}>⏭️</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
