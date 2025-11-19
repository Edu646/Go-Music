import React, { useState, useEffect } from "react";
import "./Inicio.css";

function Inicio() {
  const images = [
    "/img/carrusel1.jpg",
    "/img/carrusel2.jpg",
    "/img/carrusel3.jpg"
  ];

  const [index, setIndex] = useState(0);

  // Cambio automático cada 3 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="container">

      {/* CARRUSEL */}
      <div className="carousel">
        <img src={images[index]} alt="Carrusel" className="carousel-img" />
      </div>

      {/* DESCRIPCIÓN */}
      <div className="text-box">
        <h3>LO QUE TRATA</h3>
        <p>
          Es un proyecto basado en aplicaciones como Spotify, Apple Music, etc.
          Lo que busco con este proyecto es un lugar donde puedas escuchar la canción
          que te gusta sin anuncios y que puedas crear tu propio álbum con las canciones
          que más te gustan.
        </p>
      </div>

    </div>
  );
}

export default Inicio;
