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
   COMPONENTE PARA CREAR PLAYLISTS
========================================================================================== */
function PlaylistCreator({ user, refreshPlaylists }) {
  const [name, setName] = useState("");
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

  return (
    <form className="playlist-creator" onSubmit={handleCreate}>
      <h3>Crear Playlist</h3>
      <input type="text" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />
      <button type="submit">Crear</button>
      {msg && <p>{msg}</p>}
    </form>
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
    } catch {}
  }, [search]);

  const fetchPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      setPlaylists(await res.json());
    } catch {}
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
            {showPlaylistCreator ? "Ocultar" : "Crear Playlist"}
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
                  </div>
                ))}
              </div>
            </div>
          )}

          <SongList songs={songs} search={search} setSearch={setSearch} refreshSongs={fetchSongs} />
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

/* ==========================================================================================
   LISTA DE CANCIONES
========================================================================================== */
function SongList({ songs,search,setSearch,refreshSongs }) {
  return (
    <div className="song-list">
      <h3>Buscar canciones ({songs.length})</h3>
      <input placeholder="Nombre o artista" value={search} onChange={(e)=>setSearch(e.target.value)} />
      <button onClick={refreshSongs}>Recargar</button>

      <ul>
        {songs.length? songs.map((s,i)=>(
          <li key={s._id||i}>
            <b>{s.name}</b> - {s.artist} ({s.uploadedBy})
            <a href={s.audio} target="_blank"> 🎧 </a>
          </li>
        )):"Sin canciones"}
      </ul>
    </div>
  );
}
