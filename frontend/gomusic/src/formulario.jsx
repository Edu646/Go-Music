import React, { useState, useEffect } from "react";
import "./formulario.css";
import { auth, googleProvider, db } from "./firebaseconfig";
import { uploadSongFile } from "./upload_song";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const AuthAndUploadContainer = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="auth-container"><p>Cargando...</p></div>;
  }

  return (
    <div>
      <AuthForm user={user} />
      <FormularioSubida user={user} />
    </div>
  );
};

const AuthForm = ({ user }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [msg, setMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const saveUserProfile = async (user, username = "") => {
    if (!db || !user || !user.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email || "",
        displayName: username || user.displayName || "",
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error guardando perfil:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const { username, email, password } = formData;
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await saveUserProfile(cred.user);
        setMsg("Sesión iniciada.");
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserProfile(cred.user, username);
        setMsg("Cuenta creada.");
      }
      setFormData({ username: "", email: "", password: "" });
    } catch (err) {
      console.error(err);
      setMsg(err.message);
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMsg("");
  };

  const handleGoogleLogin = async () => {
    setMsg("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserProfile(result.user);
      setMsg("Autenticación con Google OK.");
    } catch (err) {
      console.error("Google login error:", err);
      setMsg(err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMsg("Desconectado.");
  };

  return (
    <div className="auth-container">
      <h2 className="auth-title">Bienvenido</h2>

      {user && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(16, 185, 129, 0.1)", borderRadius: 8, border: "1px solid #10b981" }}>
          <p style={{ color: "#10b981", margin: 0 }}>✓ Sesión activa: {user.email}</p>
        </div>
      )}

      {!user ? (
        <>
          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <input
                type="text"
                name="username"
                placeholder="Nombre de usuario"
                value={formData.username}
                onChange={handleChange}
                className="auth-input"
                required
              />
            )}
            <input
              type="email"
              name="email"
              placeholder="Correo electrónico"
              value={formData.email}
              onChange={handleChange}
              className="auth-input"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={handleChange}
              className="auth-input"
              required
            />
            <button type="submit" className="auth-button">
              {isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <button className="google-btn" onClick={handleGoogleLogin}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
              alt="Google logo"
              className="google-icon"
            />
            Continuar con Google
          </button>

          <button onClick={toggleForm} className="auth-toggle">
            {isLogin ? "¿No tienes cuenta? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesión"}
          </button>
        </>
      ) : (
        <button onClick={handleLogout} style={{ background: "#ef4444", width: "100%", padding: 12, borderRadius: 8, border: "none", color: "white", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      )}

      {msg && <p style={{ marginTop: 10, color: "#bbf7d0" }}>{msg}</p>}
    </div>
  );
};

export function FormularioSubida({ user }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!user) {
      setMsg("Debes iniciar sesión para subir canciones.");
      return;
    }
    if (!file) {
      setMsg("Selecciona un archivo.");
      return;
    }
    try {
      setMsg("Subiendo...");
      const result = await uploadSongFile(file, { name, artist, createdBy: user.uid }, (p) => setProgress(p));
      setMsg(`Subida completa. ID: ${result.id || "desconocido"}`);
      setFile(null);
      setName("");
      setArtist("");
      setProgress(0);
    } catch (err) {
      console.error(err);
      setMsg("Error: " + err.message);
    }
  };

  if (!user) {
    return (
      <div className="no-session">
        <p>Debes iniciar sesión para subir canciones.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Subir una canción</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre de la canción"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Artista"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
        <button type="submit">Subir canción</button>

        {progress > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#93c5fd" }}>Progreso: {progress}%</div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#10b981,#06b6d4)", transition: "width .25s" }} />
            </div>
          </div>
        )}

        {msg && <div style={{ marginTop: 8, color: msg.includes("Error") ? "#fca5a5" : "#bbf7d0", fontSize: 14 }}>{msg}</div>}
      </form>

      {/* Reproductor de audio solo si hay URL */}
      {file && file.url && (
        <audio src={file.url} controls autoPlay />
      )}
    </div>
  );
}

export default AuthAndUploadContainer;
