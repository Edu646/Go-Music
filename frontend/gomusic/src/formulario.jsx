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
  PERFIL PERSISTENTE POR USUARIO (NO se borra al cerrar sesión)
========================================================================================== */
const PROFILE_STORE_KEY = "gomusic_profiles_v1";

function loadProfile(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map?.[uid] || null;
  } catch {
    return null;
  }
}

function saveProfile(uid, data) {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[uid] = { ...(map[uid] || {}), ...data };
    localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(map));
  } catch {}
}

/* ==========================================================================================
  ACCIONES DE PLAYLIST (Cambiar privacidad, eliminar, compartir)
========================================================================================== */
function PlaylistActions({ playlist, user, refreshPlaylists }) {
  const [msg, setMsg] = useState("");

  const handleDelete = async () => {
    if (!window.confirm(`¿Seguro que quieres borrar la playlist "${playlist.name}"?`))
      return;
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
        body: JSON.stringify({ username: user.username, isPublic: !playlist.isPublic }),
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

  if (playlist.owner !== user.username) return null;

  return (
    <div className="playlist-actions">
      <button onClick={togglePrivacy} className="btn-privacy" title="Cambiar privacidad">
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
  QUITAR PLAYLIST DE MI BIBLIOTECA (SIN BORRAR AL CREADOR)
========================================================================================== */
function RemoveFromLibrary({ playlist, user, refreshPlaylists }) {
  const [msg, setMsg] = useState("");

  if (!user || playlist.owner === user.username) return null;

  const handleRemove = async () => {
    if (
      !window.confirm(
        `¿Quitar "${playlist.name}" de tu biblioteca? (No se borra del creador)`
      )
    )
      return;
    setMsg("");
    try {
      const res = await fetch(`/playlists/${playlist._id}/remove-from-library`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });
      if (res.ok) {
        setMsg("Playlist quitada de tu biblioteca ✔️");
        refreshPlaylists();
      } else {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || "No se pudo quitar (revisa el endpoint del backend)");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  return (
    <div className="playlist-actions">
      <button
        onClick={handleRemove}
        className="btn-delete"
        title="Quitar de mi biblioteca"
      >
        ➖ Quitar de mis playlists
      </button>
      {msg && <p className="action-message">{msg}</p>}
    </div>
  );
}

/* ==========================================================================================
  COMPONENTE PARA CREAR PLAYLISTS CON PRIVACIDAD
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
    formData.append("owner", user.username);
    formData.append("isPublic", String(isPublic));
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
      <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
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
  COMPONENTE PARA COMPARTIR PLAYLISTS PRIVADAS
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

  if (playlist.owner !== user.username || playlist.isPublic) return null;

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
  COMPONENTE PARA ACEPTAR PLAYLISTS COMPARTIDAS
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
        body: JSON.stringify({ song: song, username: user.username }),
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
  EDITOR DE PERFIL - CAMBIAR NOMBRE E IMAGEN
========================================================================================== */
function ProfileEditor({ user, setUser, setMessage }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user.avatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName || "");
    setPhotoPreview(user.avatar);
  }, [user, editing]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setMessage("No hay usuario autenticado");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const finalDisplayName =
        displayName?.trim() || user.displayName || user.username;
      await updateProfile(fbUser, { displayName: finalDisplayName, photoURL: null });

      const updated = {
        ...user,
        displayName: finalDisplayName,
        avatar: photoFile ? photoPreview : user.avatar,
      };
      setUser(updated);
      localStorage.setItem("gomusic_user", JSON.stringify(updated));
      if (fbUser?.uid) saveProfile(fbUser.uid, { displayName: updated.displayName, avatar: updated.avatar });

      setMessage("Perfil actualizado ✔");
      setEditing(false);
      setPhotoFile(null);
      setDisplayName(finalDisplayName);
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
        {editing ? "Cancelar" : "✏️ Editar perfil"}
      </button>
      {editing && (
        <div className="profile-editor-box">
          <div className="profile-preview">
            <img src={photoPreview} alt="Preview" className="avatar-preview" />
          </div>
          <input
            type="text"
            placeholder="Nombre de perfil"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================================
  LISTA DE CANCIONES
========================================================================================== */
function SongList({ songs, search, setSearch, refreshSongs, user, playlists, refreshPlaylists }) {
  return (
    <div className="song-list">
      <h3>Buscar canciones ({songs.length})</h3>
      <input placeholder="Nombre o artista" value={search} onChange={(e) => setSearch(e.target.value)} />
      <button onClick={refreshSongs}>Recargar</button>
      <ul>
        {songs.length ? (
          songs.map((s, i) => (
            <li key={s._id || i}>
              <div className="song-details">
                <b>{s.name}</b> - {s.artist} ({s.uploadedBy})
                <a href={s.audio} target="_blank" rel="noopener noreferrer"> 🎧 </a>
              </div>
              {user && <SongActions song={s} playlists={playlists} user={user} refreshPlaylists={refreshPlaylists} />}
            </li>
          ))
        ) : (
          "Sin canciones"
        )}
      </ul>
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

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const uid = result.user.uid;
          const storedProfile = loadProfile(uid);
          const username = result.user.displayName || result.user.email.split("@")[0];
          const displayName = storedProfile?.displayName || result.user.displayName || username;
          const avatar = storedProfile?.avatar || result.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png";
          const u = { uid, username, displayName, email: result.user.email, avatar };
          setUser(u);
          localStorage.setItem("gomusic_user", JSON.stringify(u));
          saveProfile(uid, { displayName, avatar });
          setMessage("Inicio con Google ✔");
        }
      })
      .catch((error) => {
        console.error("Error en redirect de Google:", error);
        setMessage(`Error Google: ${error.code} - ${error.message}`);
      });

    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const storedProfile = loadProfile(uid);
        const username = firebaseUser.displayName || firebaseUser.email.split("@")[0];
        const displayName = storedProfile?.displayName || firebaseUser.displayName || username;
        const avatar = storedProfile?.avatar || firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png";
        const u = { uid, username, displayName, email: firebaseUser.email, avatar };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(uid, { displayName, avatar });
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
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const uid = cred.user.uid;
        const storedProfile = loadProfile(uid);
        const username = cred.user.displayName || cred.user.email.split("@")[0];
        const displayName = storedProfile?.displayName || cred.user.displayName || username;
        const avatar = storedProfile?.avatar || cred.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png";
        const u = { uid, username, displayName, email: cred.user.email, avatar };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(uid, { displayName, avatar });
        setMessage("Sesión iniciada ✔");
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        let photoURL = null;
        if (photoFile) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", photoFile);
          try {
            const res = await fetch("/upload-avatar", { method: "POST", body: uploadFormData });
            const data = await res.json();
            if (res.ok && data.url) photoURL = data.url;
          } catch (err) {
            console.error("Error uploadando avatar:", err);
          }
        }
        await updateProfile(cred.user, { displayName: formData.username, photoURL });
        const u = {
          uid: cred.user.uid,
          username: cred.user.email.split("@")[0],
          displayName: formData.username,
          email: cred.user.email,
          avatar: photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(u.uid, { displayName: u.displayName, avatar: u.avatar });
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
      if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
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
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
                <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </>
            )}
            <input
              type="email"
              placeholder="Correo"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button onClick={handleAuth}>{isLogin ? "Entrar" : "Registrar"}</button>
          </div>
          <button onClick={handleGoogle} className="google-btn">Continuar con Google</button>
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
            <ProfileEditor user={user} setUser={setUser} setMessage={setMessage} />
          </div>

          {message && <p className="message">{message}</p>}

          <FormularioSubida user={user} refreshSongs={fetchSongs} />
          <ShareAcceptor user={user} refreshPlaylists={fetchPlaylists} />

          <button
            className="btn-playlist-toggle"
            onClick={() => setShowPlaylistCreator(!showPlaylistCreator)}
          >
            {showPlaylistCreator ? "Ocultar Creador" : "➕ Crear Nueva Playlist"}
          </button>

          {showPlaylistCreator && <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} />}

          {ownPlaylists.length > 0 && (
            <div className="user-playlists">
              <h3>Mis Playlists</h3>
              <div className="playlist-grid">
                {ownPlaylists.map((p) => (
                  <div key={p._id} className="playlist-card">
                    <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
                    <h4>{p.name} {!p.isPublic && "🔒"}</h4>
                    <p>{p.songs?.length || 0} canciones</p>
                    <PlaylistShare playlist={p} user={user} />
                    <PlaylistActions playlist={p} user={user} refreshPlaylists={fetchPlaylists} />
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
                    <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
                    <h4>{p.name} 🔒</h4>
                    <p>{p.songs?.length || 0} canciones</p>
                    <small>Por: {p.owner}</small>
                    <span className="read-only-badge">Solo lectura</span>
                    <RemoveFromLibrary playlist={p} user={user} refreshPlaylists={fetchPlaylists} />
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
      <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Subir</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
