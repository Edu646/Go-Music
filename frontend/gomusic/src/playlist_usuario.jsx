import React, { useState, useEffect } from "react";
import { usePlayer } from "./PlayerContext";
import "./playlist_usuario.css";

export default function Playlist_User() {
  const [user, setUser] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [popupPlaylist, setPopupPlaylist] = useState(null);

  const { play } = usePlayer();

  // Obtener usuario
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("gomusic_user"));
    if (storedUser) setUser(storedUser);
  }, []);

  // Obtener playlists del usuario (y mantener selected actualizado)
  const fetchPlaylists = async () => {
    if (!user) return;

    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();

      if (data?.own && data?.shared) {
        const merged = [...data.own, ...data.shared];
        setPlaylists(merged);

        // ✅ Mantener selected sincronizado con lo que viene del backend
        setSelected((prev) => {
          if (!prev) return null;
          return merged.find((x) => String(x._id) === String(prev._id)) || null;
        });

        // ✅ Mantener popup sincronizado también
        setPopupPlaylist((prev) => {
          if (!prev) return null;
          return merged.find((x) => String(x._id) === String(prev._id)) || null;
        });
      } else {
        setPlaylists([]);
        setSelected(null);
        setPopupPlaylist(null);
      }
    } catch (err) {
      console.error("Error cargando playlists:", err);
      setPlaylists([]);
      setSelected(null);
      setPopupPlaylist(null);
    }
  };

  // Obtener canciones (lista general o búsqueda)
  const fetchSongs = async () => {
    try {
      const query = search ? `/search?q=${encodeURIComponent(search)}` : "/songs";
      const res = await fetch(query);
      const data = await res.json();
      setAllSongs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando canciones:", err);
      setAllSongs([]);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchSongs();
    // eslint-disable-next-line
  }, [user, search]);

  // Agregar canción
  const addSong = async (playlistId, song) => {
    if (!user?.username) return;

    try {
      const res = await fetch(`/playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song, username: user.username }),
      });

      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error agregando canción:", err);
    }
  };

  // Quitar canción (solo si es dueño)
  const removeSong = async (playlistId, songId) => {
    if (!user?.username) return;

    const playlist = playlists.find((p) => String(p._id) === String(playlistId));
    if (!playlist || playlist.owner !== user.username) return;

    const updatedSongs = (playlist.songs || []).filter(
      (s) => String(s._id) !== String(songId)
    );

    try {
      const res = await fetch(`/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          songs: updatedSongs.map((s) => s._id),
        }),
      });

      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error quitando canción:", err);
    }
  };

  // Quitar playlist compartida de la biblioteca
  const removeSharedPlaylist = async (playlistId) => {
    if (!user?.username) return;

    try {
      const res = await fetch(`/playlists/${playlistId}/remove-from-library`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (res.ok) fetchPlaylists();
    } catch (err) {
      console.error("Error quitando playlist compartida:", err);
    }
  };

  // ✅ Reproducir desde buscador SIN cola (no permite cambiar de canción)
  const playFromSearchSingle = (song) => {
    // cola = solo esta canción
    play(song, [song], 0);
  };

  // ✅ Reproducir playlist desde el principio (con cola)
  const playPlaylistFromStart = (playlist) => {
    if (!playlist?.songs?.length) return;
    play(playlist.songs[0], playlist.songs, 0);
  };

  if (!user) return <p>Debes iniciar sesión para ver tus playlists.</p>;

  return (
    <div className="user-playlists">
      <h2>Mis Playlists</h2>

      <div className="playlist-grid">
        {playlists.length > 0 ? (
          playlists.map((p) => {
            const isOwner = p.owner === user.username;

            return (
              <div key={p._id} className="playlist-card">
                {/* ✅ Click en imagen = reproducir playlist (NO abrir popup) */}
                <img
                  src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"}
                  alt={p.name}
                  onClick={() => playPlaylistFromStart(p)}
                  style={{ cursor: "pointer" }}
                />

                <h4>{p.name}</h4>
                <p>{p.songs?.length || 0} canciones</p>

                {/* ✅ Botón para abrir el popup (ver canciones) */}
                <button onClick={() => setPopupPlaylist(p)}>Ver</button>

                {isOwner ? (
                  <button onClick={() => setSelected(p)}>Editar</button>
                ) : (
                  <>
                    <div className="shared-label">🔒 Playlist compartida</div>
                    <button onClick={() => removeSharedPlaylist(p._id)}>
                      Quitar
                    </button>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <p>No tienes playlists.</p>
        )}
      </div>

      {/* Editor */}
      {selected && selected.owner === user.username && (
        <div className="playlist-editor">
          <h3>Editando: {selected.name}</h3>
          <button onClick={() => setSelected(null)}>Cerrar</button>

          <input
            type="text"
            placeholder="Buscar canciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <h4>Resultados del buscador (Play sin cola)</h4>
          <ul>
            {allSongs.map((s) => (
              <li key={s._id}>
                {s.name} - {s.artist}

                {/* ✅ Play desde buscador: NO puedes cambiar de canción */}
                <button onClick={() => playFromSearchSingle(s)}>Play</button>

                {!selected.songs?.some(
                  (song) => String(song._id) === String(s._id)
                ) && (
                  <button onClick={() => addSong(selected._id, s)}>
                    Agregar
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h4>Canciones actuales</h4>
          <ul>
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

      {/* Popup playlist */}
      {popupPlaylist && (
        <div className="playlist-popup">
          <div className="popup-content">
            <button onClick={() => setPopupPlaylist(null)}>X</button>

            <h3>{popupPlaylist.name}</h3>

            <ul>
              {popupPlaylist.songs?.map((s, i) => (
                <li key={s._id}>
                  {s.name} - {s.artist}
                  <button onClick={() => play(s, popupPlaylist.songs, i)}>
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
