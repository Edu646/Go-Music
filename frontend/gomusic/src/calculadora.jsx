// ...existing code...
import React, { useState } from "react";
import "./calculadora.css";
import { usePlayer } from "./PlayerContext";
import API_URL from "./config"; // new: lee REACT_APP_API_URL o usa localhost por defecto

function SearchPlayer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const { play } = usePlayer();

  const handleSearch = async () => {
    setResults([]);
    const base = API_URL || ""; // si config devuelve vacío usa ruta relativa
    // intenta el endpoint /api/search (ajusta si tu backend expone /search en vez de /api/search)
    const endpoints = [`${base}/api/search?q=`, `${base}/search?q=`, `/api/search?q=`, `/search?q=`];
    let data = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ep}${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        // intentar siguiente endpoint
      }
    }
    if (data) setResults(data);
    else console.error("Error: no se pudo conectar al backend. Asegúrate de que esté corriendo y la URL en REACT_APP_API_URL sea correcta.");
  };

  const handlePlay = (song) => {
    play(song);
  };

  const enterbusca = (event) => {
    if (event.key === "Enter") {
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
          onKeyDown={enterbusca}
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
// ...existing code...  