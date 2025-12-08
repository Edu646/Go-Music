import React, { useState, useEffect } from "react";
import { usePlayer } from "./PlayerContext";
import "./playlist_usuario.css";

export default function UserPlaylists() {
  const [user, setUser] = useState(null);
  const [playlists, setPlaylists] = useState([]); // Inicializado como array vacío
  const [selected, setSelected] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [popupPlaylist, setPopupPlaylist] = useState(null);

  const { play } = usePlayer();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Obtener usuario
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("gomusic_user"));
    if (storedUser) setUser(storedUser);
  }, []);

  // --- CORRECCIÓN PRINCIPAL AQUÍ ---
  // Fetch playlists del usuario con validación de Array
 const fetchPlaylists = async () => {
  if (!user) return;
  const url = `/playlists/${user.username}`; 

  try {
    const res = await fetch(url);
    const data = await res.json();

    // --- CORRECCIÓN AQUÍ ---
    // 1. Verificamos que 'data' sea un objeto y contenga las claves esperadas
    if (data && typeof data === 'object' && Array.isArray(data.own) && Array.isArray(data.shared)) {
      
      // 2. Combinamos las playlists propias y compartidas en un solo array
      const allPlaylists = [...data.own, ...data.shared];
      
      setPlaylists(allPlaylists);

      // Lógica de actualización de 'selected' (la dejamos simple y segura)
      if (selected) {
        const updated = allPlaylists.find(p => p._id === selected._id);
        setSelected(updated || null);
      }
      
    } else {
      console.warn("La API no devolvió el formato esperado {own: [], shared: []}:", data);
      setPlaylists([]);
    }
  } catch (err) {
    console.error("Error cargando playlists:", err);
    setPlaylists([]); 
  }
};
  // Fetch de canciones
  const fetchSongs = async () => {
    try {
      const query = search ? `/search?q=${search}` : "/songs";
      const res = await fetch(query);
      const data = await res.json();
      // Validación básica también para canciones
      if (Array.isArray(data)) {
        setAllSongs(data);
      } else {
        setAllSongs([]);
      }
    } catch (err) {
      console.error("Error cargando canciones:", err);
      setAllSongs([]);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search]);

  const addSong = async (playlistId, song) => {
    try {
      const res = await fetch(`/playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Asegúrate que el backend espere { song: ... }
        body: JSON.stringify({ song }), 
      });

      if (res.ok) fetchPlaylists();
      // Si la respuesta no es OK (ej. 400), debes leer el mensaje de error
      else {
        const errorData = await res.json();
        console.error("Error del Servidor al añadir canción:", errorData);
      }
    } catch (err) {
      console.error("Error agregando canción:", err);
    }
  };

  const removeSong = async (playlistId, songId) => {
    try {
      const playlist = playlists.find((p) => p._id === playlistId);
      if (!playlist) return;

      const updatedSongs = playlist.songs.filter(
        (s) => s._id.toString() !== songId.toString()
      );

      const res = await fetch(`/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: updatedSongs.map((s) => s._id) }),
      });

      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error quitando canción:", err);
    }
  };

  // Abrir popup sin reproducir automáticamente
  const openPopup = (playlist) => {
    setPopupPlaylist(playlist);
    setCurrentIndex(0);
  };

  const closePopup = () => setPopupPlaylist(null);

  if (!user) return <p>Debes iniciar sesión para ver tus playlists.</p>;

  return (
    <div className="user-playlists">
      <h2>Mis Playlists</h2>

      <div className="playlist-grid">
        {/* Validación: Solo hacemos map si playlists es un array y tiene elementos */}
        {Array.isArray(playlists) && playlists.length > 0 ? (
          playlists.map((p) => (
            <div key={p._id} className="playlist-card">
              <img
                src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"}
                alt={p.name}
                onClick={() => openPopup(p)}
              />
              <h4>{p.name}</h4>
              {/* Uso de ?. para evitar error si songs es undefined */}
              <p>{p.songs?.length || 0} canciones</p>
              <button onClick={() => setSelected(p)}>Editar</button>
            </div>
          ))
        ) : (
          <p>No se encontraron playlists o están cargando...</p>
        )}
      </div>

      {/* Editor */}
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
            {/* Validación con ?. */}
            {allSongs?.map((s) => (
              <li key={s._id}>
                {s.name} - {s.artist}
                {/* Validación extra dentro del find */}
                {!selected.songs?.some(
                  (song) => song._id.toString() === s._id.toString()
                ) && (
                  <button onClick={() => addSong(selected._id, s)}>
                    Agregar
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h4>Canciones actuales:</h4>
          <ul>
            {/* Validación con ?. */}
            {selected.songs?.map((s) => (
              <li key={s._id}>
                {s.name} - {s.artist}
                <button onClick={() => removeSong(selected._id, s._id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Popup sin flechas */}
      {popupPlaylist && (
        <div className="playlist-popup">
          <div className="popup-content">
            <button className="close-popup" onClick={closePopup}>
              X
            </button>

            <img
              src={
                popupPlaylist.image ||
                "https://i.ibb.co/4pDNDk1/avatar-default.png"
              }
              alt={popupPlaylist.name}
            />

            <h3>{popupPlaylist.name}</h3>

            <ul className="popup-song-list">
              {/* Validación con ?. */}
              {popupPlaylist.songs?.map((s, i) => (
                <li key={s._id}>
                  {s.name} - {s.artist}
                  <button
                    onClick={() => {
                      setCurrentIndex(i);
                      play(s);
                    }}
                  >
                    Play
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}