// ...existing code...
import React, { useState } from "react";
import "./formulario.css";
// import firebase aquí desde el módulo común en vez de inicializar de nuevo
import { auth, googleProvider } from "./firebaseconfig";
import { uploadSongFile } from "./upload_song";

// ...existing code...
const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(isLogin
      ? `Iniciando sesión con ${formData.email}`
      : `Creando cuenta con ${formData.username} - ${formData.email}`);
  }

  const toggleForm = () => {
    setIsLogin(!isLogin);
  }

  const handleGoogleLogin = () => {
    alert("Autenticación con Google");
  }

  return (
    <div className="auth-container">
      <h2 className="auth-title">Bienvenido</h2>
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
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/512px-Google_%22G%22_Logo.svg.png" alt="Google logo" className="google-icon"/>
        Continuar con Google
      </button>

      <div className="auth-toggle" onClick={toggleForm}>
        {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <span className="toggle-span">{isLogin ? "Crear cuenta" : "Inicia sesión"}</span>
      </div>
    </div>
  )
}

export default AuthForm;

// ...existing code...
export function FormularioSubida() {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMsg("Subiendo...");
      const result = await uploadSongFile(file, { name, artist }, p => setProgress(p));
      setMsg(`Subida completa. ID: ${result.id}`);
    } catch (err) {
      setMsg("Error: " + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} required />
      <input type="text" placeholder="Artista" value={artist} onChange={e => setArtist(e.target.value)} />
      <input type="file" accept="audio/*" onChange={e => setFile(e.target.files[0])} required />
      <button type="submit">Subir canción</button>
      <div>Progreso: {progress}%</div>
      <div>{msg}</div>
    </form>
  );
}
// ...existing code...