import React, { useEffect } from "react";
import "./Inicio.css";

function Inicio() {
  useEffect(() => {
    fetch("http://localhost:3001/Inicio")
      .then((res) => res.json())
      .then((info) => {
        console.log(info); // o cualquier otra acción que quieras hacer
      })
      .catch((err) => console.error(err));
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
