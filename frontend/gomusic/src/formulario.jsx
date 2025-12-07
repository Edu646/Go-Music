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
  COMPONENTE PARA CREAR Y BORRAR PLAYLISTS (MODIFICADO)
========================================================================================== */
function PlaylistCreator({ user, refreshPlaylists, playlist }) {
  const [name, setName] = useState(playlist ? playlist.name : "");
  const [image, setImage] = useState(null);
  const [msg, setMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg("Pon un nombre a la playlist");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("owner", user.username);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("/playlists", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setMsg("Playlist creada ✔️");
        setName(""); setImage(null);
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
        // 🚨 CRÍTICO: Envío del username para validación de propiedad en el backend
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


  return (
    <>
      <form className="playlist-creator" onSubmit={handleCreate}>
        <h3>Crear Playlist</h3>
        <input type="text" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
        <button type="submit">Crear</button>
        {msg && <p>{msg}</p>}
      </form>

      {/* Si es una lista de Playlists del usuario, agregamos el botón de borrar */}
      {playlist && (
        <button onClick={() => handleDelete(playlist)} className="btn-delete">
          🗑️ Eliminar
        </button>
      )}
    </>
  );
}

/* ==========================================================================================
  NUEVO COMPONENTE: ACCIONES DE CANCIÓN (Añadir a Playlist)
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
                // 🚨 CRÍTICO: Envío del username para validación de propiedad en el backend
                body: JSON.stringify({ 
                    song: song, 
                    username: user.username 
                }), 
            });

            if (res.ok) {
                setMsg(`✔️ Agregada a "${playlistName}"`);
                refreshPlaylists(); // Para actualizar el número de canciones
                setIsAdding(false);
            } else {
                const data = await res.json();
                // El backend devuelve 403 si no es el dueño
                setMsg(data.error || "Error al añadir"); 
            }
        } catch {
            setMsg("Error de conexión");
        }
    };

    return (
        <div className="song-actions">
            <button onClick={() => setIsAdding(!isAdding)} className="btn-action">
                {isAdding ? "Cerrar" : "➕ Agregar a Playlist"}
            </button>
            {isAdding && (
                <div className="playlist-selection">
                    <h4>Selecciona una playlist:</h4>
                    {playlists.length > 0 ? (
                        playlists.map(p => (
                            <button 
                                key={p._id} 
                                onClick={() => handleAddSong(p._id, p.name)}
                                disabled={p.owner !== user.username} // Deshabilita si no es el dueño
                                title={p.owner !== user.username ? "Solo puedes añadir a tus playlists" : ""}
                            >
                                {p.name} {p.owner !== user.username ? "(Solo dueño: 🔒)" : ""}
                            </button>
                        ))
                    ) : (
                        <p>No tienes playlists.</p>
                    )}
                </div>
            )}
            {msg && <p className="action-message">{msg}</p>}
        </div>
    );
}

/* ==========================================================================================
  LISTA DE CANCIONES (MODIFICADO)
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
            {user && ( // Solo muestra las acciones si el usuario está logueado
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
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);

  /* ============================= GET SONGS & PLAYLISTS ============================= */
  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch(search ? `/search?q=${search}` : "/songs");
      setSongs(await res.json());
    } catch (e) { console.error("Error fetching songs:", e); }
  }, [search]);

  // Modificado: Ahora el frontend usa la ruta /playlists/:username
  const fetchPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      setPlaylists(await res.json());
    } catch (e) { console.error("Error fetching playlists:", e); }
  }, [user]);

  useEffect(() => { fetchSongs(); fetchPlaylists(); }, [fetchSongs, fetchPlaylists]);

  /* ============================= AUTH STATE SAVE & RESTORE ============================= */
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

  /* ============================= AUTH EMAIL/PASSWORD ============================= */
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

  /* ============================= LOGIN GOOGLE ============================= */
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

  /* ============================= LOGOUT ============================= */
  const handleLogout = async () => {
    await signOut(auth);
    setShowPlaylistCreator(false);
  };

  const toggleForm = () => { setIsLogin(!isLogin); setMessage(""); };

  /* ==========================================================================================
      RENDER UI
  ========================================================================================== */
  return (
    <div className="auth-container">

      {/* ==================== LOGIN / REGISTRO ==================== */}
      {!user && (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          <form onSubmit={handleAuth} className="auth-form">
            {!isLogin && (
              <>
                <input type="text" name="username" placeholder="Nombre de usuario"
                value={formData.username} onChange={(e)=>setFormData({...formData,username:e.target.value})} required />
                <input type="file" accept="image/*" onChange={(e)=>setPhotoFile(e.target.files[0])} />
              </>
            )}

            <input type="email" name="email" placeholder="Correo"
            value={formData.email} onChange={(e)=>setFormData({...formData,email:e.target.value})} required />

            <input type="password" name="password" placeholder="Contraseña"
            value={formData.password} onChange={(e)=>setFormData({...formData,password:e.target.value})} required />

            <button type="submit">{isLogin ? "Entrar" : "Registrar"}</button>
          </form>

          <button onClick={handleGoogle} className="google-btn">Google</button>
          <button onClick={toggleForm} className="auth-toggle">
            {isLogin ? "Crear cuenta" : "Iniciar sesión"}
          </button>

          {message && <p className="message">{message}</p>}
        </>
      )}

      {/* ==================== USER LOGGED ==================== */}
      {user && (
        <>
          <div className="user-info-box">
            <img src={user.avatar} alt="Avatar" className="avatar-img" />
            <h3>{user.username}</h3>
            <p>{user.email}</p>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>

          <FormularioSubida user={user} refreshSongs={fetchSongs} />

          <button className="btn-playlist-toggle"
          onClick={()=>setShowPlaylistCreator(!showPlaylistCreator)}>
            {showPlaylistCreator ? "Ocultar Creador" : "Crear Nueva Playlist"}
          </button>

          {showPlaylistCreator && <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} />}

          {playlists.length>0 && (
            <div className="user-playlists">
              <h3>Mis Playlists</h3>
              <div className="playlist-grid">
                {playlists.map(p=>(
                  <div key={p._id} className="playlist-card">
                    <img src={p.image || "https://i.ibb.co/4pDNDk1/avatar-default.png"} alt={p.name} />
                    <h4>{p.name}</h4>
                    <p>{p.songs?.length || 0} canciones</p>
                    {/* Botón de Borrar Playlist (solo para el creador) */}
                    <PlaylistCreator user={user} refreshPlaylists={fetchPlaylists} playlist={p} />
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
              user={user} // Pasamos el usuario para las acciones
              playlists={playlists} // Pasamos las playlists para el selector
              refreshPlaylists={fetchPlaylists}
          />
        </>
      )}
    </div>
  );
}

/* ==========================================================================================
  SUBIDA DE CANCIONES
========================================================================================== */
function FormularioSubida({ user, refreshSongs }) {
  const [file,setFile]=useState(null),[name,setName]=useState(""),[artist,setArtist]=useState(""),[msg,setMsg]=useState("");

  const handleUpload=async(e)=>{
    e.preventDefault();
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
    <form className="formulario" onSubmit={handleUpload}>
      <h3>Subir Canción</h3>
      <input placeholder="Nombre" value={name} onChange={(e)=>setName(e.target.value)} required />
      <input placeholder="Artista" value={artist} onChange={(e)=>setArtist(e.target.value)} />
      <input type="file" accept="audio/*" onChange={(e)=>setFile(e.target.files[0])} required />
      <button>Subir</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}