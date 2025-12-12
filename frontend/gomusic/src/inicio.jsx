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

  const fetchPublicPlaylists = async () => {
    try {
      setLoading(true);
      // Cambiado de /api/playlists/public a /playlists
      const response = await fetch("/playlists");
      if (response.ok) {
        const data = await response.json();
        console.log("Playlists públicas:", data); // Para debugging
        setPlaylists(data);
      } else {
        console.error("Error al obtener playlists:", response.status);
      }
    } catch (error) {
      console.error("Error obteniendo playlists públicas:", error);
    } finally {
      setLoading(false);
    }
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
              <button className="hero-button">
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
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
              Cargando playlists...
            </p>
          ) : playlists.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
              No hay playlists públicas disponibles aún
            </p>
          ) : (
            <div className="playlist-grid">
              {playlists.map((playlist) => (
                <div 
                  key={playlist._id}
                  className={`playlist-card ${hoveredCard === playlist._id ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredCard(playlist._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="playlist-image-wrapper">
                    <img 
                      src={playlist.image || 'https://via.placeholder.com/300x300?text=Playlist'} 
                      alt={playlist.name}
                      className="playlist-image"
                    />
                    {hoveredCard === playlist._id && (
                      <div className="play-button">
                        <span className="play-icon-large">▶</span>
                      </div>
                    )}
                  </div>
                  <h3 className="playlist-title">{playlist.name}</h3>
                  <p className="playlist-info">
                    {playlist.songs?.length || 0} canciones • {playlist.owner}
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
          <button className="cta-button">Explorar Ahora</button>
        </div>

      </div>
    </div>
  );
}

export default Inicio;