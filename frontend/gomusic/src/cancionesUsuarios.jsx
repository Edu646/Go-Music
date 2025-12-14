import React, { useEffect, useState } from "react";
import "./canciones_usuarios.css";
export default function CancionesUsuarios() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://go-music-3mgo.onrender.com//songs")
      .then(res => res.json())
      .then(data => {
        setSongs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const deleteSong = async (id) => {
    if (!window.confirm("¿Eliminar canción?")) return;

    await fetch(`https://go-music-3mgo.onrender.com/songs/${id}`, {
      method: "DELETE"
    });

    setSongs(songs.filter(song => song._id !== id));
  };

  if (loading) return <p>Cargando canciones...</p>;

  return (
    <div>
      <h2>🎵 Canciones subidas</h2>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Artista</th>
            <th>Subida por</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {songs.map(song => (
            <tr key={song._id}>
              <td>{song.name}</td>
              <td>{song.artist}</td>
              <td>{song.uploadedBy}</td>
              <td>
                <button onClick={() => deleteSong(song._id)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
