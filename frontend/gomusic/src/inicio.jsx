import React, { useState, useEffect } from "react";
import "./Inicio.css";

function Inicio() {
  const images = [
    "/img/carrusel1.jpg",
    "/img/carrusel2.jpg",
    "/img/carrusel3.jpg"
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div className="carousel">
        <img src={images[index]} alt="Carrusel" className="carousel-img" />
      </div>

      <div className="text-box">
        <h3>LO QUE TRATA</h3>
        <p>
          Es un proyecto basado en aplicaciones como Spotify…
        </p>
      </div>
    </div>
  );
}

export default Inicio;
