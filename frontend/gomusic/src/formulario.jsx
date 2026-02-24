import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "./firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import "./formulario.css";

/* ==========================================================================================
  CREAR PLAYLIST (SOLO CREACIÓN) — fuera de las playlists creadas
========================================================================================== */
function PlaylistCreator({ user, refreshPlaylists }) {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [msg, setMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg("Pon un nombre a la playlist");

    const formData = new FormData();
    formData.append("name", name);
    // IMPORTANT: mantenemos owner = user.username (identidad estable)
    formData.append("owner", user.username);
    formData.append("isPublic", isPublic);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("/playlists", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setMsg(`Playlist creada ✔️ ${!isPublic ? "(Privada - se generó link)" : ""}`);
        setName("");
        setImage(null);
        setIsPublic(true);
        refreshPlaylists();
      } else setMsg(data.error || "Error creando playlist");
    } catch {
      setMsg("Error creando playlist");
    }
  };

  return (
    <div className="playlist-creator">
      <h3>Crear Playlist</h3>

      <input
        type="text"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImage(e.target.files?.[0] || null)}
      />

      <label className="privacy-toggle">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <span>{isPublic ? "🌍 Pública" : "🔒 Privada"}</span>
      </label>

      <button onClick={handleCreate}>Crear</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  ACCIONES DE PLAYLIST (DELETE + PRIVACY) — separado del creador
========================================================================================== */
function PlaylistActions({ playlist, user, refreshPlaylists }) {
  const [msg, setMsg] = useState("");

  const handleDelete = async () => {
    if (!window.confirm(`¿Seguro que quieres borrar la playlist "${playlist.name}"?`)) return;
    setMsg("");
    try {
      const res = await fetch(`/playlists/${playlist._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (res.ok) {
        setMsg(`Playlist "${playlist.name}" eliminada ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error al borrar playlist");
      }
    } catch {
      setMsg("Error de conexión al borrar");
    }
  };

  const togglePrivacy = async () => {
    try {
      const res = await fetch(`/playlists/${playlist._id}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          isPublic: !playlist.isPublic,
        }),
      });

      if (res.ok) {
        setMsg(`Privacidad cambiada a ${!playlist.isPublic ? "pública" : "privada"} ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error cambiando privacidad");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  // Solo el dueño puede editar/borrar/cambiar privacidad
  if (playlist.owner !== user.username) return null;

  return (
    <div className="playlist-actions">
      <button
        onClick={togglePrivacy}
        className="btn-privacy"
        title="Cambiar privacidad"
      >
        {playlist.isPublic ? "🔒 Hacer Privada" : "🌍 Hacer Pública"}
      </button>

      <button onClick={handleDelete} className="btn-delete">
        🗑️ Eliminar
      </button>

      {msg && <p className="action-message">{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  COMPARTIR PLAYLISTS PRIVADAS
========================================================================================== */
function PlaylistShare({ playlist, user }) {
  const [showLink, setShowLink] = useState(false);
  const [msg, setMsg] = useState("");

  const shareLink = playlist.shareToken
    ? `${window.location.origin}/share/${playlist.shareToken}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setMsg("✔️ Link copiado al portapapeles");
    setTimeout(() => setMsg(""), 3000);
  };

  const regenerateToken = async () => {
    try {
      const res = await fetch(`/playlists/${playlist._id}/regenerate-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (res.ok) {
        setMsg("✔️ Nuevo link generado");
        window.location.reload();
      } else {
        setMsg("Error generando link");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  if (playlist.isPublic || playlist.owner !== user.username) return null;

  return (
    <div className="playlist-share">
      <button onClick={() => setShowLink(!showLink)} className="btn-share">
        🔗 Compartir Playlist
      </button>

      {showLink && (
        <div className="share-link-box">
          <input
            type="text"
            value={shareLink}
            readOnly
            onClick={(e) => e.target.select()}
          />
          <button onClick={copyLink}>📋 Copiar</button>
          <button onClick={regenerateToken} title="Invalida el link anterior">
            🔄 Nuevo Link
          </button>
        </div>
      )}
      {msg && <p className="share-message">{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  ACEPTAR PLAYLISTS COMPARTIDAS
========================================================================================== */
function ShareAcceptor({ user, refreshPlaylists }) {
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/share\/([a-f0-9]+)/);
    if (match) setToken(match[1]);
  }, []);

  const handleAccept = async () => {
    if (!token.trim()) return setMsg("Ingresa un código válido");

    try {
      const res = await fetch("/playlists/accept-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username: user.username }),
      });

      const data = await res.json();

      if (res.ok) {
        setMsg(`✔️ Playlist "${data.playlist.name}" agregada a tu biblioteca`);
        setToken("");
        refreshPlaylists();
        window.history.replaceState({}, document.title, "/");
      } else {
        setMsg(data.error || "Error al agregar playlist");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  return (
    <div className="share-acceptor">
      <h3>📥 Agregar Playlist Compartida</h3>
      <div className="share-input-group">
        <input
          type="text"
          placeholder="Pega el código o link aquí"
          value={token}
          onChange={(e) => {
            const value = e.target.value;
            const match = value.match(/([a-f0-9]{32})/);
            setToken(match ? match[1] : value);
          }}
        />
        <button onClick={handleAccept}>Agregar</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  ACCIONES DE CANCIÓN
========================================================================================== */
function SongActions({ song, playlists, user, refreshPlaylists }) {
  const [msg, setMsg] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddSong = async (playlistId, playlistName) => {
    setMsg("Añadiendo...");
    try {
      const res = await fetch(`/playlists/${playlistId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song: song,
          username: user.username,
        }),
      });

      if (res.ok) {
        setMsg(`✔️ Agregada a "${playlistName}"`);
        refreshPlaylists();
        setIsAdding(false);
      } else {
        const data = await res.json();
        setMsg(data.error || "Error al añadir");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  const editablePlaylists = playlists.filter((p) => p.owner === user.username);

  return (
    <div className="song-actions">
      <button onClick={() => setIsAdding(!isAdding)} className="btn-action">
        {isAdding ? "Cerrar" : "➕ Agregar a Playlist"}
      </button>
      {isAdding && (
        <div className="playlist-selection">
          <h4>Selecciona una playlist:</h4>
          {editablePlaylists.length > 0 ? (
            editablePlaylists.map((p) => (
              <button key={p._id} onClick={() => handleAddSong(p._id, p.name)}>
                {p.name} {!p.isPublic && "🔒"}
              </button>
            ))
          ) : (
            <p>No tienes playlists propias.</p>
          )}
        </div>
      )}
      {msg && <p className="action-message">{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  LISTA DE CANCIONES
========================================================================================== */
function SongList({
  songs,
  search,
  setSearch,
  refreshSongs,
  user,
  playlists,
  refreshPlaylists,
}) {
  return (
    <div className="song-list">
      <h3>Buscar canciones ({songs.length})</h3>
      <input
        placeholder="Nombre o artista"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button onClick={refreshSongs}>Recargar</button>

      <ul>
        {songs.length
          ? songs.map((s, i) => (
              <li key={s._id || i}>
                <div className="song-details">
                  <b>{s.name}</b> - {s.artist} ({s.uploadedBy})
                  <a href={s.audio} target="_blank" rel="noopener noreferrer">
                    {" "}
                    🎧{" "}
                  </a>
                </div>
                {user && (
                  <SongActions
                    song={s}
                    playlists={playlists}
                    user={user}
                    refreshPlaylists={refreshPlaylists}
                  />
                )}
              </li>
            ))
          : "Sin canciones"}
      </ul>
    </div>
  );
}

/* ==========================================================================================
  EDITAR PERFIL (NOMBRE + FOTO) CUANDO YA HAS INICIADO SESIÓN
  - Cambia displayName (visible), NO cambia user.username (identidad estable para playlists/back).
========================================================================================== */
function ProfileEditor({ user, setUser, setMessage }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || user.username || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName || user.username || "");
  }, [user]);

  const handleSave = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    setSaving(true);
    setMessage("");

    try {
      let photoURL = fbUser.photoURL || user.avatar;

      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        try {
          const res = await fetch("/upload-avatar", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (res.ok) photoURL = data.url;
        } catch (err) {
          console.error("Error uploadando avatar:", err);
        }
      }

      await updateProfile(fbUser, {
        displayName: displayName?.trim() || fbUser.displayName || user.username,
        photoURL: photoURL || null,
      });

      const updated = {
        ...user,
        // username se mantiene (lo usa tu backend en playlists)
        displayName: displayName?.trim() || user.username,
        avatar: photoURL || user.avatar,
      };

      setUser(updated);
      localStorage.setItem("gomusic_user", JSON.stringify(updated));
      setMessage("Perfil actualizado ✔");
      setEditing(false);
      setPhotoFile(null);
    } catch (err) {
      console.error("Error actualizando perfil:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-editor">
      <button className="btn-action" onClick={() => setEditing(!editing)}>
        {editing ? "Cerrar edición" : "✏️ Editar perfil"}
      </button>

      {editing && (
        <div className="profile-editor-box">
          <input
            type="text"
            placeholder="Nombre visible"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />

          <button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>

          <small style={{ display: "block", marginTop: 8, opacity: 0.8 }}>
            Nota: el “Nombre visible” cambia tu displayName, pero tu “username” interno se mantiene
            para no romper propiedad de playlists.
          </small>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================================
  MAIN COMPONENT
========================================================================================== */
export default function Formulario() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [ownPlaylists, setOwnPlaylists] = useState([]);
  const [sharedPlaylists, setSharedPlaylists] = useState([]);
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch(search ? `/search?q=${search}` : "/songs");
      setSongs(await res.json());
    } catch (e) {
      console.error("Error fetching songs:", e);
    }
  }, [search]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setOwnPlaylists(data.own || []);
      setSharedPlaylists(data.shared || []);
    } catch (e) {
      console.error("Error fetching playlists:", e);
    }
  }, [user]);

  useEffect(() => {
    fetchSongs();
    fetchPlaylists();
  }, [fetchSongs, fetchPlaylists]);

  // Manejo de autenticación de Firebase
  useEffect(() => {
    // Manejo del redirect de Google
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const u = {
            // username estable (no lo “editamos” para no romper playlists/back)
            username: result.user.email.split("@")[0],
            // displayName visible (editable)
            displayName: result.user.displayName || result.user.email.split("@")[0],
            email: result.user.email,
            avatar:
              result.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
          };
          setUser(u);
          localStorage.setItem("gomusic_user", JSON.stringify(u));
          setMessage("Inicio con Google ✔");
        }
      })
      .catch((error) => {
        console.error("Error en redirect de Google:", error);
        setMessage(`Error Google: ${error.code} - ${error.message}`);
      });

    // Listener de cambios de auth
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          username: firebaseUser.email.split("@")[0],
          displayName:
            firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email,
          avatar:
            firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
      } else {
        setUser(null);
        localStorage.removeItem("gomusic_user");
      }
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        setUser({
          username: cred.user.email.split("@")[0],
          displayName:
            cred.user.displayName || cred.user.email.split("@")[0],
          email: cred.user.email,
          avatar:
            cred.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        });
        setMessage("Sesión iniciada ✔");
      } else {
        // REGISTRO + FOTO A ELEGIR
        const cred = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        let photoURL = null;
        if (photoFile) {
          const formData = new FormData();
          formData.append("file", photoFile);
          try {
            const res = await fetch("/upload-avatar", {
              method: "POST",
              body: formData
            });
            const data = await res.json();
            if (res.ok) photoURL = data.url;
          } catch (err) {
            console.error("Error uploadando avatar:", err);
          }
        }

        await updateProfile(cred.user, {
          displayName: formData.username,
          photoURL,
        });

        setUser({
          username: cred.user.email.split("@")[0], // estable
          displayName: formData.username, // visible
          email: cred.user.email,
          avatar: photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        });

        setMessage("Cuenta creada ✔");
      }

      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      console.error("Error en autenticación:", err);
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleGoogle = async () => {
    setMessage("Redirigiendo a Google...");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error en popup, intentando redirect:", error);
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Error en redirect:", redirectError);
          setMessage(`Error: ${redirectError.code} - ${redirectError.message}`);
        }
      } else {
        setMessage(`Error Google: ${error.code} - ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowPlaylistCreator(false);
    setMessage("");
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  const allPlaylists = [...ownPlaylists, ...sharedPlaylists];

  return (
    <div className="auth-container">
      {!user && (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          <div className="auth-form">
            {!isLogin && (
              <>
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
              </>
            )}

            <input
              type="email"
              placeholder="Correo"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />

            <button onClick={handleAuth}>
              {isLogin ? "Entrar" : "Registrar"}
            </button>
          </div>

          <button onClick={handleGoogle} className="google-btn">
            Continuar con Google
          </button>
          <button onClick={toggleForm} className="auth-toggle">
            {isLogin ? "Crear cuenta" : "Iniciar sesión"}
          </button>

          {message && <p className="message">{message}</p>}
        </>
      )}

      {user && (
        <>
          <div className="user-info-box">
            <img src={user.avatar} alt="Avatar" className="avatar-img" />
            <h3>{user.displayName || user.username}</h3>
            <p>{user.email}</p>
            <button onClick={handleLogout}>Cerrar sesión</button>

            {/* NUEVO: editar nombre + foto */}
            <ProfileEditor user={user} setUser={setUser} setMessage={setMessage} />
          </div>

          {message && <p className="message">{message}</p>}

          <FormularioSubida user={user} refreshSongs={fetchSongs} />

          <ShareAcceptor user={user} refreshPlaylists={fetchPlaylists} />

          {/* CREADOR DE PLAYLISTS (FUERA de las playlists creadas) */}
          <button
            className="btn-playlist-toggle"
            onClick={() => setShowPlaylistCreator(!showPlaylistCreator)}
          >
            {showPlaylistCreator ? "Ocultar Creador" : "Crear Nueva Playlist"}
          </button>

          {showPlaylistCreator && (
            <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} />
          )}

          {ownPlaylists.length > 0 && (
            <div className="user-playlists">
              <h3>Mis Playlists</h3>
              <div className="playlist-grid">
                {ownPlaylists.map((p) => (
                  <div key={p._id} className="playlist-card">
                    <img
                      src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"}
                      alt={p.name}
                    />
                    <h4>
                      {p.name} {!p.isPublic && "🔒"}
                    </h4>
                    <p>{p.songs?.length || 0} canciones</p>

                    <PlaylistShare playlist={p} user={user} />
                    <PlaylistActions
                      playlist={p}
                      user={user}
                      refreshPlaylists={fetchPlaylists}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {sharedPlaylists.length > 0 && (
            <div className="shared-playlists">
              <h3>📥 Playlists Compartidas Conmigo</h3>
              <div className="playlist-grid">
                {sharedPlaylists.map((p) => (
                  <div key={p._id} className="playlist-card shared">
                    <img
                      src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"}
                      alt={p.name}
                    />
                    <h4>{p.name} 🔒</h4>
                    <p>{p.songs?.length || 0} canciones</p>
                    <small>Por: {p.owner}</small>
                    <span className="read-only-badge">Solo lectura</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SongList
            songs={songs}
            search={search}
            setSearch={setSearch}
            refreshSongs={fetchSongs}
            user={user}
            playlists={allPlaylists}
            refreshPlaylists={fetchPlaylists}
          />
        </>
      )}
    </div>
  );
}

function FormularioSubida({ user, refreshSongs }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [msg, setMsg] = useState("");

  const handleUpload = async () => {
    if (!file) return setMsg("Sube un archivo");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("artist", artist);
    // mantiene username estable
    fd.append("username", user.username);

    try {
      const res = await fetch("/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        setMsg("✔ subida");
        setName("");
        setArtist("");
        setFile(null);
        refreshSongs();
      } else {
        setMsg(data.error || "Error");
      }
    } catch {
      setMsg("Falló el servidor");
    }
  };

  return (
    <div className="formulario">
      <h3>Subir Canción</h3>
      <input
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Artista"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
      />
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload}>Subir</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}