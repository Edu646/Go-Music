import React, { useState, useEffect } from "react";
import "./Inicio.css";

function Inicio() {
  const images = [
    "/imagenes/Gemini_Generated_Image_grymgwgrymgwgrym (1).png",
    "/imagenes/Gemini_Generated_Image_grymgwgrymgwgrym (2).png",
    "/imagenes/Gemini_Generated_Image_grymgwgrymgwgrym (3).png"
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
