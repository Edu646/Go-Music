import React, { useState } from "react";
import "./calculadora.css";
import { usePlayer } from "./PlayerContext";

function SearchPlayer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const { play } = usePlayer(); 
  const handleSearch = () => {
    fetch(`http://localhost:3001/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => console.error(err));
  };

  const handlePlay = (song) => {
    play(song);
  };

  const enterbusca = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="search-player-container">
      <h1>Buscar Canciones</h1>
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <input
          type="text"
          placeholder="Escribe nombre o artista"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={enterbusca}
        />
        <button type="submit">Buscar</button>
      </form>

      <div style={{ marginTop: "20px" }}>
        {results.map(song => (
          <div key={song.id} className="song-result">
            <span>
              <strong>{song.name}</strong> - {song.artist}
            </span>
            <button onClick={() => handlePlay(song)}>
              Play
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default SearchPlayer;
