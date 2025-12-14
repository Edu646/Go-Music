import React, { useEffect, useState } from "react";
import "./Canciones_usuarios.css";

export default function CancionesUsuarios() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("https://go-music-3mgo.onrender.com/songs")
      .then(res => {
        if (!res.ok) throw new Error("Error al cargar canciones");
        return res.json();
      })
      .then(data => {
        setSongs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const deleteSong = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta canción?")) return;

    try {
      const response = await fetch(`https://go-music-3mgo.onrender.com/songs/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la canción");
      }

      // Solo actualizar el estado si la eliminación fue exitosa
      setSongs(songs.filter(song => song._id !== id));
    } catch (err) {
      console.error("Error:", err);
      alert("No se pudo eliminar la canción. Por favor, intenta de nuevo.");
    }
  };

  if (loading) {
    return (
      <div className="canciones-container">
        <p>Cargando canciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="canciones-container">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="canciones-container">
      <h2>🎵 Canciones subidas</h2>

      <table className="canciones-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Artista</th>
            <th>Subida por</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {songs.length === 0 ? (
            <tr>
              <td colSpan="4">No hay canciones disponibles</td>
            </tr>
          ) : (
            songs.map(song => (
              <tr key={song._id}>
                <td>{song.name}</td>
                <td>{song.artist}</td>
                <td>{song.uploadedBy}</td>
                <td>
                  <button 
                    className="btn-delete-song"
                    onClick={() => deleteSong(song._id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}