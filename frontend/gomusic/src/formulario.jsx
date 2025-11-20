import React, { useState, useEffect, useCallback } from "react";
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
import { setCurrentUser, logoutUser } from "./auth";
import "./formulario.css";

export default function Formulario({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");

  // Fetch canciones
  const fetchSongs = useCallback(async () => {
    try {
      const query = search ? `/search?q=${search}` : "/songs";
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

  // Escucha estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          username: firebaseUser.displayName || firebaseUser.email.split("@")[0],
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png"
        };
        setUser(u);
        setCurrentUser(u);
        if (onLogin) onLogin(u.username); // avisar a App que hay usuario
      } else {
        setUser(null);
        logoutUser();
      }
    });
    return () => unsubscribe();
  }, [onLogin]);

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
        const u = {
          username: cred.user.displayName || cred.user.email.split("@")[0],
          email: cred.user.email,
          avatar: cred.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png"
        };
        setUser(u);
        setCurrentUser(u);
        setMessage("Sesión iniciada correctamente");
        if (onLogin) onLogin(u.username);
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
        setCurrentUser(u);
        setMessage("Cuenta creada correctamente");
        if (onLogin) onLogin(u.username);
      }
      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      console.error(err);
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
      setCurrentUser(u);
      setMessage("Sesión iniciada con Google");
      if (onLogin) onLogin(u.username);
    } catch (err) {
      console.error(err);
      setMessage("Error iniciando con Google");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    logoutUser();
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
          {/* Aquí puedes mostrar subida de canciones o lista */}
        </>
      )}
    </div>
  );
}
