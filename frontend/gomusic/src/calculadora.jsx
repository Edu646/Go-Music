import React, { useState } from "react";
import { usePlayer } from "./PlayerContext";
import "./calculadora.css";
const API_URL = process.env.REACT_APP_API_URL || "";

function SearchPlayer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const { play } = usePlayer();

  const handleSearch = async () => {
    if (!query.trim()) return setResults([]);

    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      const adjustedData = data.map((song) => ({
        ...song,
        // Aseguramos que la URL sea completa para que la descarga funcione bien
        audio: song.audio.startsWith("http") ? song.audio : `${API_URL}${song.audio}`,
      }));

      setResults(adjustedData);
    } catch (err) {
      console.error("No se pudo conectar al backend:", err.message);
      setResults([]);
    }
  };

  const handlePlay = (song) => {
    play(song);
  };

  const handleEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };

  // Función opcional para forzar la descarga si el atributo 'download' falla por CORS
  const handleDownload = async (e, song) => {
    // Si el backend está en el mismo dominio, el <a> funciona solo.
    // Si quieres hacerlo visualmente o traquearlo, puedes usar esta función.
    // Por ahora, confiaremos en el atributo download del HTML abajo.
  };

  return (
    <div className="search-container">
      <h2>Buscar Canciones</h2>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <input
          type="text"
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
        />
        <button type="submit">Buscar</button>
      </form>

      <div className="results-list">
        {results.map((song) => (
          <div className="song-item" key={song.id || song.name}>
            <div className="song-info">
              {song.name} - {song.artist}
            </div>
            
            <div className="song-actions">
              {/* Botón de Reproducir */}
              <button onClick={() => handlePlay(song)} style={{ marginRight: "10px" }}>
                Play
              </button>

              {/* Botón de Descargar */}
              <a 
                href={song.audio} 
                download={`${song.name}.mp3`} // Sugiere el nombre del archivo
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-download" // Clase para darle estilo si quieres
                style={{ textDecoration: 'none', border: '1px solid #ccc', padding: '2px 5px', color: 'black', background: '#f0f0f0' }}
              >
                Descargar
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchPlayer;