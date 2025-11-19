import React, { useState, useEffect, useCallback } from "react";
import "./formulario.css";

// ----------------------------------------------------
// 1. COMPONENTE PRINCIPAL: AuthForm (Gestión de Estado)
// ----------------------------------------------------
export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  
  // ✅ Nuevo Estado: Datos de las canciones y Búsqueda
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");


  // Función para cargar las canciones desde el backend
  const fetchSongs = useCallback(async () => {
    try {
        // Usamos /songs para listar y /search para buscar
        const query = search ? `/search?q=${search}` : '/songs';
        const res = await fetch(query);
        const data = await res.json();
        setSongs(data);
    } catch (err) {
        console.error("Error al cargar canciones:", err);
    }
  }, [search]); // Se ejecuta cada vez que 'search' cambia

  // Cargar canciones iniciales (o cuando el usuario cambia)
  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = (e) => {
    e.preventDefault();
    setMessage("");
    // Usamos el username si existe, sino el email
    const dummyUser = { username: formData.username || formData.email, email: formData.email };
    setUser(dummyUser);
    setMessage(isLogin ? "Sesión iniciada" : "Cuenta creada");
    setFormData({ username: "", email: "", password: "" });
    // Al iniciar sesión, cargamos las canciones
    // fetchSongs(); // Esto ya se hace en el useEffect al cambiar 'user'
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  const handleLogout = () => {
    setUser(null);
    setMessage("Desconectado.");
    setSongs([]); // Limpiamos la lista al desconectar
  };

  return (
    <div className="auth-container">
      {!user ? (
        // --- Formulario de Login/Registro ---
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
        // --- Área de Usuario Conectado ---
        <>
          <p>Conectado como: {user.username || user.email}</p>
          <button onClick={handleLogout} style={{ marginBottom: 20 }}>
            Logout
          </button>
          
          {/* ✅ Pasamos la función de refresco */}
          <FormularioSubida user={user} refreshSongs={fetchSongs} /> 
          
          {/* ✅ Pasamos los datos y la búsqueda */}
          <SongList songs={songs} search={search} setSearch={setSearch} refreshSongs={fetchSongs} /> 
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 2. COMPONENTE: FormularioSubida (Corregido)
// ----------------------------------------------------
// Recibe 'refreshSongs' para actualizar la lista tras el éxito
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
    // ✅ Aseguramos que el username enviado sea el correcto para el backend
    formData.append("username", user.username || user.email); 

    try {
      setMsg("Subiendo a Cloudinary...");

      const res = await fetch("/upload", { // La URL relativa es correcta
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setMsg(`✅ Canción '${data.name}' subida correctamente.`);
        setFile(null);
        setName("");
        setArtist("");
        
        // ✅ Llamamos a la función de refresco
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
      {msg && <p>{msg}</p>}
    </form>
  );
}

// ----------------------------------------------------
// 3. COMPONENTE: SongList (Simplificado)
// ----------------------------------------------------
// Recibe los datos ya filtrados y el estado de búsqueda del padre
function SongList({ songs, search, setSearch, refreshSongs }) {

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    // Nota: El fetch ocurrirá automáticamente en el componente AuthForm debido al useEffect.
  }

  // Si usamos la búsqueda en el backend, no necesitamos filtrar en el frontend:
  // const filteredSongs = songs.filter(...) ya que el backend lo hace.

  return (
    <div className="song-list">
      <h3>Buscar Canciones ({songs.length} resultados)</h3>
      <input
        type="text"
        placeholder="Buscar por nombre o artista"
        value={search}
        onChange={handleSearchChange}
      />
      {/* Botón opcional para recargar manualmente la lista (útil para debug) */}
      <button onClick={refreshSongs} style={{ marginLeft: '10px' }}>Recargar Lista</button>

      <ul>
        {songs.length > 0 ? (
            songs.map((song, idx) => (
              // ✅ Aquí está la clave: song.audio ya es la URL de Cloudinary
              <li key={song.id || idx}>
                <strong>{song.name}</strong> - {song.artist} (Subida por: {song.uploadedBy}){" "}
                <a href={song.audio} target="_blank" rel="noopener noreferrer">
                  🎵 Escuchar / Descargar
                </a>
              </li>
            ))
        ) : (
            <li>{search ? "No se encontraron resultados." : "No hay canciones subidas aún."}</li>
        )}
      </ul>
    </div>
  );
}