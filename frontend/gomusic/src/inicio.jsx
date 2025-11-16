import React, { useEffect } from "react";
import "./Inicio.css";
import API_URL from "../config";

function Inicio() {
  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then((info) => {
        console.log("Backend OK:", info);
      })
      .catch((err) => console.error("Error llamando backend:", err));
  }, []);

  return (
    <div className="container">
      <div>
        <div>
          <h3>LO QUE TRATA</h3>
          <p>
            Es un proyecto basado en aplicaciones como Spotify, Apple Music, etc.
            Lo que busco con este proyecto es un lugar donde puedas escuchar la canción
            que te gusta sin anuncios y que puedas crear tu propio álbum con las canciones
            que más te gustan.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Inicio;
