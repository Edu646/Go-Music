import React, { useEffect, useState } from "react";
import "./Admin_Panel.css";

function Admin_Panel() {
  const [stats, setStats] = useState({
    songs: 0,
    users: 0,
    playlists: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [songsRes, usersRes, playlistsRes] = await Promise.all([
          fetch("/songs"),
          fetch("/users"),
          fetch("/playlists"),
        ]);

        const songs = await songsRes.json();
        const users = await usersRes.json();
        const playlists = await playlistsRes.json();

        setStats({
          songs: songs.length,
          users: users.length,
          playlists: playlists.length,
        });
      } catch (err) {
        console.error("Error cargando estadísticas:", err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="admin-container">
      
      {/* HERO BONITO */}
      <div className="admin-hero">
        <div className="hero-content">
          <h1>🎧 Bienvenido al Panel de Administración</h1>
          <p>
            Desde aquí puedes supervisar el estado completo de la plataforma,
            controlar usuarios, canciones y gestionar el contenido de GoMusic.
          </p>

          <div className="hero-stats">
            <div>
              <span>{stats.songs}</span>
              <p>Canciones subidas</p>
            </div>
            <div>
              <span>{stats.users}</span>
              <p>Usuarios registrados</p>
            </div>
            <div>
              <span>{stats.playlists}</span>
              <p>Playlists públicas</p>
            </div>
          </div>
        </div>
      </div>

      {/* INFORMACIÓN EXTRA */}
      <div className="admin-info">
        <h2>📊 Información del sistema</h2>
        <p>
          Actualmente hay <strong>{stats.songs}</strong> canciones almacenadas en Cloudinary 
          y registradas en MongoDB Atlas.
        </p>
        <p>
          La plataforma cuenta con <strong>{stats.users}</strong> usuarios activos 
          que interactúan mediante chat en tiempo real y playlists compartidas.
        </p>
        <p>
          Se han creado <strong>{stats.playlists}</strong> playlists públicas 
          disponibles para toda la comunidad.
        </p>
      </div>

    </div>
  );
}

export default Admin_Panel;
