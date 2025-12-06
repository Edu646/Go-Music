import React, { useState, useEffect } from "react";
import { Play, Music, TrendingUp, Clock, Heart } from "lucide-react";
import "./Inicio.css";

function Inicio() {
  const images = [
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80",
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
    "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80"
  ];

  const [index, setIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [images.length]);

  const playlists = [
    { id: 1, title: "Rock Clásico", songs: 50, image: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80" },
    { id: 2, title: "Éxitos Pop", songs: 75, image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80" },
    { id: 3, title: "Jazz Suave", songs: 40, image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300&q=80" },
    { id: 4, title: "Electrónica", songs: 60, image: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&q=80" }
  ];

  const recentTracks = [
    { title: "Bohemian Rhapsody", artist: "Queen", duration: "5:55" },
    { title: "Hotel California", artist: "Eagles", duration: "6:30" },
    { title: "Stairway to Heaven", artist: "Led Zeppelin", duration: "8:02" }
  ];

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
                <Play size={20} fill="white" />
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
            <Music size={28} className="title-icon" />
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
            <TrendingUp size={28} className="title-icon" />
            Playlists Destacadas
          </h2>
          <div className="playlist-grid">
            {playlists.map((playlist) => (
              <div 
                key={playlist.id}
                className={`playlist-card ${hoveredCard === playlist.id ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredCard(playlist.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="playlist-image-wrapper">
                  <img 
                    src={playlist.image} 
                    alt={playlist.title}
                    className="playlist-image"
                  />
                  {hoveredCard === playlist.id && (
                    <div className="play-button">
                      <Play size={24} fill="white" />
                    </div>
                  )}
                </div>
                <h3 className="playlist-title">{playlist.title}</h3>
                <p className="playlist-info">{playlist.songs} canciones</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reproducidas recientemente */}
        <div className="section">
          <h2 className="section-title">
            <Clock size={28} className="title-icon" />
            Reproducidas Recientemente
          </h2>
          <div className="track-list">
            {recentTracks.map((track, idx) => (
              <div key={idx} className="track-item">
                <div className="track-left">
                  <div className="track-number">{idx + 1}</div>
                  <div className="track-info">
                    <div className="track-title">{track.title}</div>
                    <div className="track-artist">{track.artist}</div>
                  </div>
                </div>
                <div className="track-right">
                  <Heart size={18} className="heart-icon" />
                  <span className="track-duration">{track.duration}</span>
                </div>
              </div>
            ))}
          </div>
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