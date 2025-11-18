import React, { useState } from "react";
import "./formulario.css";

export default function Formulario() {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setMessage("Selecciona un archivo primero.");

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("artist", artist);

      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ Canción subida: ${data.name} (${data.url})`);
        setName("");
        setArtist("");
        setFile(null);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Error subiendo la canción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="formulario" onSubmit={handleSubmit}>
      <h2>Subir Canción</h2>

      <label>
        Nombre de la canción:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label>
        Artista:
        <input
          type="text"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
      </label>

      <label>
        Archivo de audio:
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Subiendo..." : "Subir"}
      </button>

      {message && <p className="message">{message}</p>}
    </form>
  );
}
