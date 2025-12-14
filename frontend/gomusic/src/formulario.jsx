import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider, storage } from "./firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./formulario.css";

/* ==========================================================================================
  COMPONENTE PARA CREAR PLAYLISTS CON PRIVACIDAD
========================================================================================== */
function PlaylistCreator({ user, refreshPlaylists, playlist }) {
  const [name, setName] = useState(playlist ? playlist.name : "");
  const [image, setImage] = useState(null);
  const [isPublic, setIsPublic] = useState(playlist ? playlist.isPublic : true);
  const [msg, setMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg("Pon un nombre a la playlist");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("owner", user.username);
    formData.append("isPublic", isPublic);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("/playlists", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setMsg(`Playlist creada ✔️ ${!isPublic ? '(Privada - se generó link)' : ''}`);
        setName(""); 
        setImage(null);
        setIsPublic(true);
        refreshPlaylists();
      } else setMsg(data.error || "Error creando playlist");

    } catch {
      setMsg("Error creando playlist");
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Seguro que quieres borrar la playlist "${p.name}"?`)) return;
    setMsg("");
    try {
      const res = await fetch(`/playlists/${p._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (res.ok) {
        setMsg(`Playlist "${p.name}" eliminada ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error al borrar playlist");
      }
    } catch {
      setMsg("Error de conexión al borrar");
    }
  };

  const togglePrivacy = async (p) => {
    try {
      const res = await fetch(`/playlists/${p._id}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: user.username, 
          isPublic: !p.isPublic 
        }),
      });

      if (res.ok) {
        setMsg(`Privacidad cambiada a ${!p.isPublic ? 'pública' : 'privada'} ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error cambiando privacidad");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  return (
    <>
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
          onChange={(e) => setImage(e.target.files[0])} 
        />
        
        <label className="privacy-toggle">
          <input 
            type="checkbox" 
            checked={isPublic} 
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span>{isPublic ? '🌍 Pública' : '🔒 Privada'}</span>
        </label>

        <button onClick={handleCreate}>Crear</button>
        {msg && <p>{msg}</p>}
      </div>

      {playlist && (
        <div className="playlist-actions">
          <button 
            onClick={() => togglePrivacy(playlist)} 
            className="btn-privacy"
            title="Cambiar privacidad"
          >
            {playlist.isPublic ? '🔒 Hacer Privada' : '🌍 Hacer Pública'}
          </button>
          <button onClick={() => handleDelete(playlist)} className="btn-delete">
            🗑️ Eliminar
          </button>
        </div>
      )}
    </>
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
  COMPONENTE PARA ACEPTAR PLAYLISTS COMPARTIDAS
========================================================================================== */
function ShareAcceptor({ user, refreshPlaylists }) {
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/share\/([a-f0-9]+)/);
    if (match) {
      setToken(match[1]);
    }
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
                    username: user.username 
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

    const editablePlaylists = playlists.filter(p => p.owner === user.username);

    return (
        <div className="song-actions">
            <button onClick={() => setIsAdding(!isAdding)} className="btn-action">
                {isAdding ? "Cerrar" : "➕ Agregar a Playlist"}
            </button>
            {isAdding && (
                <div className="playlist-selection">
                    <h4>Selecciona una playlist:</h4>
                    {editablePlaylists.length > 0 ? (
                        editablePlaylists.map(p => (
                            <button 
                                key={p._id} 
                                onClick={() => handleAddSong(p._id, p.name)}
                            >
                                {p.name} {!p.isPublic && '🔒'}
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
function SongList({ songs, search, setSearch, refreshSongs, user, playlists, refreshPlaylists }) {
  return (
    <div className="song-list">
      <h3>Buscar canciones ({songs.length})</h3>
      <input placeholder="Nombre o artista" value={search} onChange={(e) => setSearch(e.target.value)} />
      <button onClick={refreshSongs}>Recargar</button>

      <ul>
        {songs.length ? songs.map((s, i) => (
          <li key={s._id || i}>
            <div className="song-details">
                <b>{s.name}</b> - {s.artist} ({s.uploadedBy})
                <a href={s.audio} target="_blank" rel="noopener noreferrer"> 🎧 </a>
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
        )) : "Sin canciones"}
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
    } catch (e) { console.error("Error fetching songs:", e); }
  }, [search]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setOwnPlaylists(data.own || []);
      setSharedPlaylists(data.shared || []);
    } catch (e) { console.error("Error fetching playlists:", e); }
  }, [user]);

  useEffect(() => { fetchSongs(); fetchPlaylists(); }, [fetchSongs, fetchPlaylists]);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          username: firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
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
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        setUser({
          username: cred.user.displayName || cred.user.email.split("@")[0],
          email: cred.user.email,
          avatar: cred.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        });
        setMessage("Sesión iniciada ✔");
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

        let photoURL=null;
        if(photoFile){
          const refPath=ref(storage,`avatars/${cred.user.uid}`);
          await uploadBytes(refPath,photoFile);
          photoURL=await getDownloadURL(refPath);
        }

        await updateProfile(cred.user,{ displayName:formData.username,photoURL });
        setUser({ username:formData.username,email:cred.user.email,avatar:photoURL || null });
        setMessage("Cuenta creada ✔");
      }

      setFormData({ username:"",email:"",password:"" });
      setPhotoFile(null);

    } catch (err) { setMessage(err.message); }
  };

  const handleGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setUser({
        username: res.user.displayName,
        email: res.user.email,
        avatar: res.user.photoURL
      });
      setMessage("Inicio con Google ✔");
    } catch { setMessage("Error con Google"); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowPlaylistCreator(false);
  };

  const toggleForm = () => { setIsLogin(!isLogin); setMessage(""); };

  const allPlaylists = [...ownPlaylists, ...sharedPlaylists];

  return (
    <div className="auth-container">
      {!user && (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          <div className="auth-form">
            {!isLogin && (
              <>
                <input type="text" placeholder="Nombre de usuario"
                value={formData.username} onChange={(e)=>setFormData({...formData,username:e.target.value})} />
                <input type="file" accept="image/*" onChange={(e)=>setPhotoFile(e.target.files[0])} />
              </>
            )}

            <input type="email" placeholder="Correo"
            value={formData.email} onChange={(e)=>setFormData({...formData,email:e.target.value})} />

            <input type="password" placeholder="Contraseña"
            value={formData.password} onChange={(e)=>setFormData({...formData,password:e.target.value})} />

            <button onClick={handleAuth}>{isLogin ? "Entrar" : "Registrar"}</button>
          </div>

          <button onClick={handleGoogle} className="google-btn">Google</button>
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
            <h3>{user.username}</h3>
            <p>{user.email}</p>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>

          <FormularioSubida user={user} refreshSongs={fetchSongs} />

          <ShareAcceptor user={user} refreshPlaylists={fetchPlaylists} />

          <button className="btn-playlist-toggle"
          onClick={()=>setShowPlaylistCreator(!showPlaylistCreator)}>
            {showPlaylistCreator ? "Ocultar Creador" : "Crear Nueva Playlist"}
          </button>

          {showPlaylistCreator && <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} />}

          {ownPlaylists.length > 0 && (
            <div className="user-playlists">
              <h3>Mis Playlists</h3>
              <div className="playlist-grid">
                {ownPlaylists.map(p=>(
                  <div key={p._id} className="playlist-card">
                    <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
                    <h4>{p.name} {!p.isPublic && '🔒'}</h4>
                    <p>{p.songs?.length || 0} canciones</p>
                    
                    <PlaylistShare playlist={p} user={user} />
                    <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} playlist={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {sharedPlaylists.length > 0 && (
            <div className="shared-playlists">
              <h3>📥 Playlists Compartidas Conmigo</h3>
              <div className="playlist-grid">
                {sharedPlaylists.map(p=>(
                  <div key={p._id} className="playlist-card shared">
                    <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
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
  const [file,setFile]=useState(null),[name,setName]=useState(""),[artist,setArtist]=useState(""),[msg,setMsg]=useState("");

  const handleUpload=async()=>{
    if(!file) return setMsg("Sube un archivo");

    const fd=new FormData();
    fd.append("file",file); fd.append("name",name);
    fd.append("artist",artist); fd.append("username",user.username);

    try{
      const res=await fetch("/upload",{method:"POST",body:fd});
      const data=await res.json();

      if(res.ok){ setMsg("✔ subida"); setName("");setArtist("");setFile(null);refreshSongs(); }
      else setMsg(data.error||"Error");
    }catch{ setMsg("Falló el servidor"); }
  };

  return (
    <div className="formulario">
      <h3>Subir Canción</h3>
      <input placeholder="Nombre" value={name} onChange={(e)=>setName(e.target.value)} />
      <input placeholder="Artista" value={artist} onChange={(e)=>setArtist(e.target.value)} />
      <input type="file" accept="audio/*" onChange={(e)=>setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Subir</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}