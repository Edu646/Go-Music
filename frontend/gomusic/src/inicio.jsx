import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Inicio.css";

function Inicio() {
  const navigate = useNavigate();
  const images = [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
    "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80"
  ];

  const [index, setIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    fetchPublicPlaylists();
  }, []);

  // Obtener playlists públicas desde el backend
  const fetchPublicPlaylists = async () => {
    try {
      setLoading(true);
      const response = await fetch("/playlists"); // Endpoint de playlists públicas
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

  // Navegar a los detalles de una playlist específica
  const handlePlaylistClick = (playlistId) => {
    navigate(`/playlist/${playlistId}`);
  };

  // Reproducir playlist directamente (previene propagación del evento)
  const handlePlayPlaylist = (e, playlistId) => {
    e.stopPropagation();
    // Navegar a la página de la playlist para reproducirla
    navigate(`/playlist/${playlistId}`);
  };

  // Cambiar imagen del carrusel manualmente
  const handleIndicatorClick = (i) => {
    setIndex(i);
  };

  return (
    <div className="page-wrapper">
      {/* Hero Section con Carrusel */}
      <div className="hero-section">
        <div className="carousel-container">
          <img 
            src={images[index]} 
            alt="Carrusel musical" 
            className="carousel-image"
          />
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
                className={`indicator ${i === index ? 'active' : ''}`}
                onClick={() => handleIndicatorClick(i)}
                style={{ cursor: 'pointer' }}
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
            Es un proyecto basado en aplicaciones como Spotify, diseñado para ofrecerte 
            la mejor experiencia musical. Explora millones de canciones, crea tus propias 
            playlists y descubre nuevos artistas cada día.
          </p>
        </div>

        {/* Playlists destacadas */}
        <div className="section">
          <h2 className="section-title">
            <span className="title-icon">📈</span>
            Playlists Destacadas
          </h2>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="loading-spinner"></div>
              <p style={{ color: '#1db954', marginTop: '1rem', fontSize: '1.1rem' }}>
                Cargando playlists...
              </p>
            </div>
          ) : playlists.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              background: 'rgba(0,0,0,0.3)', 
              borderRadius: '12px',
              border: '2px dashed rgba(255,255,255,0.2)'
            }}>
              <p style={{ color: '#888', fontSize: '1.2rem', marginBottom: '1rem' }}>
                📭 No hay playlists públicas disponibles aún
              </p>
              <p style={{ color: '#666', fontSize: '1rem' }}>
                ¡Sé el primero en crear una playlist pública!
              </p>
            </div>
          ) : (
            <div className="playlist-grid">
              {playlists.map((playlist) => (
                <div 
                  key={playlist._id}
                  className={`playlist-card ${hoveredCard === playlist._id ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredCard(playlist._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handlePlaylistClick(playlist._id)}
                  style={{ cursor: 'pointer' }}
                  title={`Ver playlist: ${playlist.name}`}
                >
                  <div className="playlist-image-wrapper">
                    <img 
                      src={playlist.image || 'https://via.placeholder.com/300x300/1db954/ffffff?text=Playlist'} 
                      alt={playlist.name}
                      className="playlist-image"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x300/1db954/ffffff?text=Playlist';
                      }}
                    />
                    {hoveredCard === playlist._id && (
                      <div 
                        className="play-button"
                        onClick={(e) => handlePlayPlaylist(e, playlist._id)}
                        title="Reproducir ahora"
                      >
                        <span className="play-icon-large">▶</span>
                      </div>
                    )}
                  </div>
                  <h3 className="playlist-title">{playlist.name}</h3>
                  <p className="playlist-info">
                    {playlist.songs?.length || 0} {playlist.songs?.length === 1 ? 'canción' : 'canciones'} • {playlist.owner}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Final */}
        <div className="cta-section">
          <h2 className="cta-title">¿Listo para empezar?</h2>
          <p className="cta-text">Únete a millones de usuarios que ya disfrutan de la mejor música</p>
          <button 
            className="cta-button"
            onClick={handleStartListening}
          >
            Explorar Ahora
          </button>
        </div>

      </div>
    </div>
  );
}

export default Inicio;