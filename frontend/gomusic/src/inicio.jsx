import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import "./Inicio.css";

function Inicio() {
  const navigate = useNavigate();
  const images = [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
    "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80",
  ];

  const [index, setIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Sesión
  const [isLogged, setIsLogged] = useState(false);

  // ✅ Popup login requerido
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    fetchPublicPlaylists();
  }, []);

  // ✅ Escuchar cambios de sesión (Firebase)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setIsLogged(!!u);
    });
    return () => unsub();
  }, []);

  // Obtener playlists públicas desde el backend
  const fetchPublicPlaylists = async () => {
    try {
      setLoading(true);
      const response = await fetch("/playlists");
      if (response.ok) {
        const data = await response.json();
        console.log("Playlists públicas cargadas:", data);
        setPlaylists(data);
      } else {
        console.error("Error al obtener playlists:", response.status);
        setPlaylists([]);
      }
    } catch (error) {
      console.error("Error obteniendo playlists públicas:", error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  // Navegar a la página de búsqueda de canciones
  const handleStartListening = () => {
    navigate("/calculadora");
  };

  const requireLogin = () => {
    setShowLoginPopup(true);
  };

  // Navegar a los detalles de una playlist específica (solo si logueado)
  const handlePlaylistClick = (playlistId) => {
    if (!isLogged) return requireLogin();
    navigate(`/playlist/${playlistId}`);
  };

  // Reproducir playlist directamente (previene propagación del evento)
  const handlePlayPlaylist = (e, playlistId) => {
    e.stopPropagation();
    if (!isLogged) return requireLogin();
    navigate(`/playlist/${playlistId}`);
  };

  // Cambiar imagen del carrusel manualmente
  const handleIndicatorClick = (i) => {
    setIndex(i);
  };

  // Cerrar popup
  const closePopup = () => setShowLoginPopup(false);

  // Ir a login (ajusta ruta si tu login está en otro sitio)
  const goToLogin = () => {
    setShowLoginPopup(false);
    navigate("/SESION");
  };

  return (
    <div className="page-wrapper">
      {/* ✅ POPUP: Login requerido */}
      {showLoginPopup && (
        <div
          className="login-popup-overlay"
          onClick={closePopup}
          role="dialog"
          aria-modal="true"
        >
          <div className="login-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Inicia sesión</h3>
            <p>Para ver o usar esta playlist tienes que iniciar sesión.</p>
            <div className="login-popup-actions">
              <button className="login-popup-btn cancel" onClick={closePopup}>
                Cerrar
              </button>
              <button className="login-popup-btn ok" onClick={goToLogin}>
                Ir a iniciar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section con Carrusel */}
      <div className="hero-section">
        <div className="carousel-container">
          <img src={images[index]} alt="Carrusel musical" className="carousel-image" />
          <div className="hero-overlay">
            <div className="hero-content">
              <h1 className="hero-title">Descubre Tu Música</h1>
              <p className="hero-subtitle">Miles de canciones, artistas y playlists esperándote</p>
              <button className="hero-button" onClick={handleStartListening}>
                <span className="play-icon">▶</span>
                <span className="button-text">Comenzar a Escuchar</span>
              </button>
            </div>
          </div>

          {/* Indicadores del carrusel */}
          <div className="carousel-indicators">
            {images.map((_, i) => (
              <div
                key={i}
                className={`indicator ${i === index ? "active" : ""}`}
                onClick={() => handleIndicatorClick(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Contenedor principal */}
      <div className="container">
        {/* Sección: Lo que trata */}
        <div className="about-section">
          <h2 className="section-title">
            <span className="title-icon">🎵</span>
            Lo Que Trata
          </h2>
          <p className="about-text">
            Es un proyecto basado en aplicaciones como Spotify, diseñado para ofrecerte la mejor
            experiencia musical. Explora millones de canciones, crea tus propias playlists y descubre
            nuevos artistas cada día.
          </p>
        </div>

        {/* Playlists destacadas */}
        <div className="section">
          <h2 className="section-title">
            <span className="title-icon">📈</span>
            Playlists Destacadas
          </h2>

          {loading ? (
            <div className="loading-message">Cargando playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-title">No hay playlists públicas disponibles aún</p>
              <p className="empty-state-text">¡Sé el primero en crear una playlist pública!</p>
            </div>
          ) : (
            <div className="playlist-grid">
              {playlists.map((playlist) => (
                <div
                  key={playlist._id}
                  className={`playlist-card ${hoveredCard === playlist._id ? "hovered" : ""}`}
                  onMouseEnter={() => setHoveredCard(playlist._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handlePlaylistClick(playlist._id)}
                  title={
                    isLogged
                      ? `Ver playlist: ${playlist.name}`
                      : "Inicia sesión para acceder a esta playlist"
                  }
                >
                  <div className="playlist-image-wrapper">
                    <img
                      src={playlist.image || "https://via.placeholder.com/300x300/1db954/ffffff?text=Playlist"}
                      alt={playlist.name}
                      className="playlist-image"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/300x300/1db954/ffffff?text=Playlist";
                      }}
                    />
                    {hoveredCard === playlist._id && (
                      <button
                        className="play-button"
                        onClick={(e) => handlePlayPlaylist(e, playlist._id)}
                        title={isLogged ? "Reproducir ahora" : "Inicia sesión para reproducir"}
                        aria-label="Reproducir playlist"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  <h3 className="playlist-title">{playlist.name}</h3>
                  <p className="playlist-info">
                    {playlist.songs?.length || 0}{" "}
                    {playlist.songs?.length === 1 ? "canción" : "canciones"} • {playlist.owner}
                  </p>

                  {!isLogged && (
                    <p className="playlist-login-hint">
                      🔒 Inicia sesión para abrir esta playlist
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Final */}
        <div className="cta-section">
          <h2 className="cta-title">¿Listo para empezar?</h2>
          <p className="cta-text">Únete a millones de usuarios que ya disfrutan de la mejor música</p>
          <button className="cta-button" onClick={handleStartListening}>
            Explorar Ahora
          </button>
        </div>
      </div>
    </div>
  );
}

export default Inicio;
