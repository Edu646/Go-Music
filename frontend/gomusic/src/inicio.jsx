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

  // ✅ Username (tu app usa localStorage gomusic_user)
  const [username, setUsername] = useState("Anónimo");

  // ✅ Popup login requerido
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  // ✅ Toast simple
  const [toast, setToast] = useState({ show: false, text: "" });

  // ✅ IDs de playlists que YA tienes (own + shared)
  const [libraryIds, setLibraryIds] = useState(new Set());

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

      // Leer username desde localStorage (igual que en otras pantallas tuyas)
      try {
        const stored = JSON.parse(localStorage.getItem("gomusic_user"));
        setUsername(stored?.username || "Anónimo");
      } catch {
        setUsername("Anónimo");
      }
    });

    // también lo intentamos al montar aunque firebase tarde
    try {
      const stored = JSON.parse(localStorage.getItem("gomusic_user"));
      setUsername(stored?.username || "Anónimo");
    } catch {
      setUsername("Anónimo");
    }

    return () => unsub();
  }, []);

  // ✅ Cada vez que haya login + username, recargamos biblioteca
  useEffect(() => {
    if (!isLogged || !username || username === "Anónimo") {
      setLibraryIds(new Set());
      return;
    }
    fetchUserLibrary();
    // eslint-disable-next-line
  }, [isLogged, username]);

  const showToast = (text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2500);
  };

  const requireLogin = () => setShowLoginPopup(true);
  const closePopup = () => setShowLoginPopup(false);

  const goToLogin = () => {
    setShowLoginPopup(false);
    navigate("/SESION");
  };

  // Obtener playlists públicas
  const fetchPublicPlaylists = async () => {
    try {
      setLoading(true);
      const response = await fetch("/playlists");
      if (!response.ok) {
        console.error("Error al obtener playlists:", response.status);
        setPlaylists([]);
        return;
      }
      const data = await response.json();
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error obteniendo playlists públicas:", error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Obtener biblioteca del usuario (own + shared) -> IDs
  const fetchUserLibrary = async () => {
    try {
      const res = await fetch(`/playlists/${encodeURIComponent(username)}`);
      const data = await res.json();

      const merged = [];
      if (Array.isArray(data?.own)) merged.push(...data.own);
      if (Array.isArray(data?.shared)) merged.push(...data.shared);

      const ids = new Set(merged.map((p) => String(p._id)));
      setLibraryIds(ids);
    } catch (err) {
      console.error("Error cargando biblioteca del usuario:", err);
      setLibraryIds(new Set());
    }
  };

  // Navegar a la página de búsqueda de canciones
  const handleStartListening = () => {
    navigate("/calculadora");
  };

  // ✅ VER: quieres que vaya a /playlist (sin id en ruta)
  // Le pasamos el id por state y también por query ?id=
  const viewPlaylist = (e, playlistId) => {
    e?.stopPropagation?.();
    if (!isLogged) return requireLogin();

    navigate(`/playlist?id=${encodeURIComponent(playlistId)}`, {
      state: { playlistId },
    });
  };

  // ✅ AÑADIR a biblioteca (shared)
  const addToLibrary = async (e, playlist) => {
    e.stopPropagation();

    if (!isLogged) return requireLogin();
    if (!username || username === "Anónimo") return requireLogin();

    // Si eres dueño, ya la tienes
    if (playlist.owner === username) {
      return showToast("✅ Esta playlist es tuya (ya la tienes).");
    }

    // Si ya está en tu biblioteca
    if (libraryIds.has(String(playlist._id))) {
      return showToast("✅ Ya tienes esta playlist en tu biblioteca.");
    }

    const payload = {
      username,
      user: username, // ✅ por si tu backend usa "user"
      playlistId: playlist._id, // ✅ por si tu backend lo pide
    };

    // ✅ Intento 1: POST
    try {
      let res = await fetch(`/playlists/${playlist._id}/add-to-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ Si el backend no admite POST (405/404), intentamos PUT
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch(`/playlists/${playlist._id}/add-to-library`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("Error add-to-library:", res.status, t);
        return showToast("❌ No se pudo añadir. Revisa el backend/endpoint.");
      }

      // ✅ Actualizamos biblioteca en frontend y volvemos a pedir al backend
      setLibraryIds((prev) => {
        const next = new Set(prev);
        next.add(String(playlist._id));
        return next;
      });

      await fetchUserLibrary(); // 🔥 esto es lo que hará que aparezca en SESION si el backend lo guarda
      showToast("📌 Playlist añadida a tu biblioteca.");
    } catch (err) {
      console.error("Error añadiendo a biblioteca:", err);
      showToast("❌ Error de conexión.");
    }
  };

  // Carrusel manual
  const handleIndicatorClick = (i) => setIndex(i);

  return (
    <div className="page-wrapper">
      {toast.show && <div className="toast">{toast.text}</div>}

      {/* ✅ POPUP login */}
      {showLoginPopup && (
        <div
          className="login-popup-overlay"
          onClick={closePopup}
          role="dialog"
          aria-modal="true"
        >
          <div className="login-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Inicia sesión</h3>
            <p>Para añadir o ver esta playlist tienes que iniciar sesión.</p>
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

      {/* Hero */}
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

      {/* Contenido */}
      <div className="container">
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
              {playlists.map((playlist) => {
                const isOwner = playlist.owner === username;
                const alreadyInLibrary = libraryIds.has(String(playlist._id));
                const disabledAdd = isOwner || alreadyInLibrary;

                return (
                  <div
                    key={playlist._id}
                    className={`playlist-card ${hoveredCard === playlist._id ? "hovered" : ""}`}
                    onMouseEnter={() => setHoveredCard(playlist._id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    style={{ cursor: "default" }}
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

                      {/* Botón rápido VER en hover */}
                      {hoveredCard === playlist._id && (
                        <button
                          className="play-button"
                          onClick={(e) => viewPlaylist(e, playlist._id)}
                          title={isLogged ? "Ver playlist" : "Inicia sesión para ver"}
                          aria-label="Ver playlist"
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

                    <div className="playlist-actions">
                      <button
                        className="playlist-add-btn"
                        onClick={(e) => addToLibrary(e, playlist)}
                        disabled={disabledAdd}
                        title={
                          !isLogged
                            ? "Inicia sesión para añadir"
                            : isOwner
                            ? "Esta playlist es tuya"
                            : alreadyInLibrary
                            ? "Ya la tienes en tu biblioteca"
                            : "Añadir a mi biblioteca"
                        }
                      >
                        {isOwner ? "Ya es tuya" : alreadyInLibrary ? "Ya la tienes" : "Añadir"}
                      </button>

                      <button
                        className="playlist-view-btn"
                        onClick={(e) => viewPlaylist(e, playlist._id)}
                        title={isLogged ? "Ver playlist" : "Inicia sesión para ver"}
                      >
                        Ver
                      </button>
                    </div>

                    {!isLogged && (
                      <p className="playlist-login-hint">🔒 Inicia sesión para añadir o ver</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
