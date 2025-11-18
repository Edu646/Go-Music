import React, { useState } from "react";
import "./formulario.css";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = (e) => {
    e.preventDefault();
    setMessage("");
    // Login simulado, se puede reemplazar con Firebase Auth
    const dummyUser = { username: formData.username, email: formData.email };
    setUser(dummyUser);
    setMessage(isLogin ? "Sesión iniciada" : "Cuenta creada");
    setFormData({ username: "", email: "", password: "" });
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  const handleLogout = () => {
    setUser(null);
    setMessage("Desconectado.");
  };

  return (
    <div className="auth-container">
      {!user ? (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <form onSubmit={handleAuth} className="auth-form">
            {!isLogin && (
              <input
                type="text"
                name="username"
                placeholder="Nombre de usuario"
                value={formData.username}
                onChange={handleChange}
                required
              />
            )}
            <input
              type="email"
              name="email"
              placeholder="Correo electrónico"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</button>
          </form>
          <button onClick={toggleForm} className="auth-toggle">
            {isLogin ? "¿No tienes cuenta? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesión"}
          </button>
          {message && <p className="message">{message}</p>}
        </>
      ) : (
        <>
          <p>Conectado como: {user.username || user.email}</p>
          <button onClick={handleLogout} style={{ marginBottom: 20 }}>
            Logout
          </button>
          <FormularioSubida user={user} />
        </>
      )}
    </div>
  );
}

function FormularioSubida({ user }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMsg("Selecciona un archivo primero.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    formData.append("artist", artist);

    try {
      setMsg("Subiendo...");
      const res = await fetch("https://go-music-3mgo.onrender.com/upload", { // reemplaza con tu URL del backend
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setMsg(`✅ Canción subida correctamente. URL: ${data.url}`);
        setFile(null);
        setName("");
        setArtist("");
        setProgress(100);
      } else {
        setMsg(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Error subiendo la canción");
    } finally {
      setProgress(0);
    }
  };

  return (
    <form onSubmit={handleUpload} className="formulario">
      <h3>Subir Canción</h3>
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
      {progress > 0 && <p>Progreso: {progress}%</p>}
      {msg && <p>{msg}</p>}
    </form>
  );
}
