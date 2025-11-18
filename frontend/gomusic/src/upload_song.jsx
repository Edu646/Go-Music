import React, { useState } from "react";

export default function UploadSong({ onUpload }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  const handleUpload = async () => {
    if (!file) return alert("Selecciona un archivo primero.");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUrl(data.url);
        if (onUpload) onUpload(data.url);
      } else {
        alert("Error subiendo canción: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error subiendo canción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir"}
      </button>
      {url && (
        <p>
          URL subida: <a href={url}>{url}</a>
        </p>
      )}
    </div>
  );
}
