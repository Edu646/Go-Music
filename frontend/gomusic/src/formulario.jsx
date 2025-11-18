import React, { useState, useEffect } from "react";
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
    const dummyUser = { username: formData.username || formData.email, email: formData.email };
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
          <SongList /> {/* Mostrar canciones subidas y permitir descarga */}
        </>
      )}
    </div>
  );
}

// -----------------------
// Formulario para subir canciones
// -----------------------
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
    formData.append("username", user.username); // Enviar username al backend

    try {
      setMsg("Subiendo...");
      setProgress(0);

      const res = await fetch("/upload", { // Ajusta la URL si tu backend no es relativo
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setMsg(`✅ Canción subida correctamente. URL: ${data.url}`);
        setFile(null);
        setName("");
        setArtist("");
        setProgress(100);
      } else {
        setMsg(`❌ Error: ${data.error || "Desconocido"}`);
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Error subiendo la canción");
    } finally {
      setTimeout(() => setProgress(0), 1500);
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

// -----------------------
// Lista de canciones y descarga
// -----------------------
function SongList() {
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/songs")
      .then(res => res.json())
      .then(data => setSongs(data))
      .catch(err => console.error(err));
  }, []);

  const filteredSongs = songs.filter(
    s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="song-list">
      <h3>Buscar Canciones</h3>
      <input
        type="text"
        placeholder="Buscar por nombre o artista"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ul>
        {filteredSongs.map((song, idx) => (
          <li key={idx}>
            <strong>{song.name}</strong> - {song.artist} (Subida por: {song.uploadedBy}){" "}
            <a href={song.audio} target="_blank" rel="noopener noreferrer">
              🎵 Descargar / Escuchar
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
