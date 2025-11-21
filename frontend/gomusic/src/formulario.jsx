import React, { useState, useEffect, useCallback } from "react";
// 💡 NUEVA IMPORTACIÓN: Debes importar tu socket para la desconexión
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

export default function Formulario() {
  // ... (Estados sin cambios) ...
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");

  // 🛠️ CORRECCIÓN: Ajustamos el endpoint de búsqueda
  const fetchSongs = useCallback(async () => {
    try {
      // Endpoint correcto: /songs?q=... (asumiendo el backend espera 'q' como query param)
      const query = search 
        ? `/songs?q=${encodeURIComponent(search)}` 
        : '/songs';
      
      const res = await fetch(query);
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      console.error("Error al cargar canciones:", err);
    }
  }, [search]); // Correcto

  // ... (useEffect de fetchSongs y onAuthStateChanged sin cambios) ...
  
  // ... (handleAuth y handleGoogle sin cambios, ya que estaban bien) ...

  const handleLogout = async () => {
    // 1. Desconectar de Firebase Auth
    await signOut(auth);
    
    // 2. 🚨 SOLUCIÓN BUG: Desconectar el socket para eliminar el estado 'en línea'
    if (socket && socket.connected) {
      socket.disconnect();
    }
    
    // 3. Limpiar estado local
    setUser(null);
    localStorage.removeItem("gomusic_user"); 
    setMessage("Sesión cerrada");
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  return (
    // ... (El JSX permanece sin cambios) ...
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

          {/* Formulario de subida de canciones */}
          <FormularioSubida user={user} refreshSongs={fetchSongs} />

          {/* Lista de canciones */}
          <SongList songs={songs} search={search} setSearch={setSearch} refreshSongs={fetchSongs} />
        </>
      )}
    </div>
  );
}

// ... (El resto de los componentes FormularioSubida y SongList están bien) ...