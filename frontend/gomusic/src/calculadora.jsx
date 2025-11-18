import React, { useState } from "react";
import "./calculadora.css";
import { usePlayer } from "./PlayerContext";

const API_URL = process.env.REACT_APP_API_URL || ""; // Usa la variable de entorno o ruta relativa

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

      // Ajustar URLs de audio para producción
      const adjustedData = data.map((song) => ({
        ...song,
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

  return (
    <section className="search-player-container">
      <h1>Buscar Canciones</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <input
          type="text"
          placeholder="Escribe nombre o artista"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleEnter}
        />
        <button type="submit">Buscar</button>
      </form>

      <div style={{ marginTop: "20px" }}>
        {results.map((song) => (
          <div key={song.id} className="song-result">
            <span>
              <strong>{song.name}</strong> - {song.artist}
            </span>
            <button onClick={() => handlePlay(song)}>Play</button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SearchPlayer;
