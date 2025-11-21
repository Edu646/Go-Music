import React, { useState, useEffect, useCallback } from "react";
import socket from "./socket"; 
import { auth, googleProvider, storage } from "./firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./formulario.css";

// Componente Subida (Mantenido sin cambios funcionales)
function FormularioSubida({ user, refreshSongs }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [msg, setMsg] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMsg("Selecciona un archivo primero.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("artist", artist);
    formData.append("username", user.username);

    try {
      setMsg("Subiendo a Cloudinary...");
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Canción '${data.name}' subida correctamente.`);
        setFile(null);
        setName("");
        setArtist("");
        refreshSongs();
      } else {
        setMsg(`❌ Error: ${data.error || "Desconocido"}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Error subiendo la canción. ¿Servidor activo?");
    }
  };

  return (
    <form onSubmit={handleUpload} className="formulario">
      <h3>Subir Canción</h3>
      <input type="text" placeholder="Nombre de la canción" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="text" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0])} required />
      <button type="submit">Subir canción</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}

// Componente Lista de Canciones (Mantenido sin cambios funcionales)
function SongList({ songs, search, setSearch, refreshSongs }) {
  const handleSearchChange = (e) => setSearch(e.target.value);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la canción '${name}'?`)) {
      return;
    }
    try {
      const res = await fetch(`/songs/${id}`, { method: "DELETE" });
      if (res.ok) {
        refreshSongs(); 
      } else {
        alert("Error eliminando la canción.");
      }
    } catch (err) {
      console.error("Error de red al eliminar:", err);
      alert("Error de red.");
    }
  };

  return (
    <div className="song-list">
      <h3>Buscar Canciones ({songs.length} resultados)</h3>
      <input type="text" placeholder="Buscar por nombre o artista" value={search} onChange={handleSearchChange} />
      <button onClick={refreshSongs} style={{ marginLeft: '10px' }}>Recargar Lista</button>
      <ul>
        {songs.length > 0 ? songs.map((song, idx) => (
          <li key={song._id || idx}>
            <strong>{song.name}</strong> - {song.artist} (Subida por: {song.uploadedBy}){" "}
            <a href={song.audio} target="_blank" rel="noopener noreferrer">🎵 Escuchar / Descargar</a>
            <button 
              onClick={() => handleDelete(song._id, song.name)} 
              style={{ marginLeft: '10px', color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              🗑️
            </button>
          </li>
        )) : <li>{search ? "No se encontraron resultados." : "No hay canciones subidas aún."}</li>}
      </ul>
    </div>
  );
}

// -------------------------------------------------------
// COMPONENTE PRINCIPAL
// -------------------------------------------------------

// Función auxiliar para emitir conexión y estado online
const connectAndEmitOnline = (username) => {
    if (socket && !socket.connected) {
      socket.connect();
    }
    if (socket) {
      socket.emit("userOnline", username);
    }
};

export default function Formulario() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");

  const fetchSongs = useCallback(async () => {
    try {
      const query = search ? `/songs?q=${encodeURIComponent(search)}` : '/songs';
      const res = await fetch(query);
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      console.error("Error al cargar canciones:", err);
    }
  }, [search]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Escucha de estado de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // 🚨 FIX: Intenta obtener el username de localStorage primero si existe 
        // para evitar que el displayName (que a veces tarda en actualizarse)
        // ponga un valor genérico temporalmente.
        const storedUser = JSON.parse(localStorage.getItem("gomusic_user"));
        
        const u = {
          // Usamos el username guardado o el displayName si existe. 
          // Si no, usamos la parte del email.
          username: storedUser?.username || firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png"
        };
        
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u)); 
        
        // Conectar el socket al iniciar sesión
        if (u.username) {
          connectAndEmitOnline(u.username);
        }
        
      } else {
        setUser(null);
        localStorage.removeItem("gomusic_user");
        
        // Desconectar el socket si la sesión se pierde
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handlePhotoChange = (e) => setPhotoFile(e.target.files[0]);

  const uploadPhoto = async (uid) => {
    if (!photoFile) return null;
    const photoRef = ref(storage, `avatars/${uid}`);
    await uploadBytes(photoRef, photoFile);
    return await getDownloadURL(photoRef);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const firebaseUser = cred.user;

        const u = {
          username: firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png"
        };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        setMessage("Sesión iniciada correctamente");
        
        // Emitir estado online al iniciar sesión
        connectAndEmitOnline(u.username);
        
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const photoURL = photoFile ? await uploadPhoto(cred.user.uid) : null;
        await updateProfile(cred.user, { displayName: formData.username, photoURL });
        const u = {
          username: formData.username,
          email: cred.user.email,
          avatar: photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png"
        };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        setMessage("Cuenta creada correctamente");

        // Emitir estado online al registrarse
        connectAndEmitOnline(u.username);
      }
      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      console.log(err);
      setMessage(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = {
        username: result.user.displayName,
        email: result.user.email,
        avatar: result.user.photoURL
      };
      setUser(u);
      localStorage.setItem("gomusic_user", JSON.stringify(u));
      setMessage("Sesión iniciada con Google");
      
      // Emitir estado online
      connectAndEmitOnline(u.username);
      
    } catch (err) {
      console.log(err);
      setMessage("Error iniciando con Google");
    }
  };

  // Desconexión explícita del Socket.io y cierre de sesión
  const handleLogout = async () => {
    if (socket && socket.connected) {
      socket.disconnect(); 
    }
    
    await signOut(auth);
    
    setUser(null);
    localStorage.removeItem("gomusic_user"); 
    setMessage("Sesión cerrada");
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  return (
    <div className="auth-container">
      {!user ? (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <form onSubmit={handleAuth} className="auth-form"> 
            {!isLogin && (
              <>
                <input type="text" name="username" placeholder="Nombre de usuario" value={formData.username} onChange={handleChange} required />
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </>
            )}
            <input type="email" name="email" placeholder="Correo electrónico" value={formData.email} onChange={handleChange} required />
            <input type="password" name="password" placeholder="Contraseña" value={formData.password} onChange={handleChange} required />
            <button type="submit">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</button>
          </form>

          <button onClick={handleGoogle} className="google-btn">Iniciar sesión con Google</button>
          <button onClick={toggleForm} className="auth-toggle">{isLogin ? "¿No tienes cuenta? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesión"}</button>
          {message && <p className="message">{message}</p>}
        </>
      ) : (
        <>
          <div className="user-info-box">
            <img src={user.avatar} alt="Avatar" className="avatar-img" />
            <h3>{user.username}</h3>
            <p>{user.email}</p>
            <button onClick={handleLogout} className="logout-btn">Cerrar sesión</button>
          </div>

          <FormularioSubida user={user} refreshSongs={fetchSongs} />

          <SongList songs={songs} search={search} setSearch={setSearch} refreshSongs={fetchSongs} />
        </>
      )}
    </div>
  );
}