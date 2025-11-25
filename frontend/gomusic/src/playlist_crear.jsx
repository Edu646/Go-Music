import React, { useState } from "react";

export default function PlaylistCreator({ user, refreshPlaylists }) {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null);
  const [msg, setMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg("Pon un nombre a la playlist");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("owner", user.username);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("/playlists", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setMsg("Playlist creada ✔️");
        setName("");
        setImage(null);
        refreshPlaylists();
      } else {
        setMsg(data.error);
      }
    } catch (err) {
      setMsg("Error creando playlist");
    }
  };

  return (
    <form className="playlist-creator" onSubmit={handleCreate}>
      <h3>Crear nueva Playlist</h3>
      <input
        type="text"
        placeholder="Nombre de la playlist"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />

      <button>Crear Playlist</button>

      {msg && <p>{msg}</p>}
    </form>
  );
}
