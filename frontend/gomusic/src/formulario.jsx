import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider, storage } from "./firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "./formulario.css";

/* ==========================================================================================
  COMPONENTE PARA CREAR PLAYLISTS CON PRIVACIDAD
========================================================================================== */
function PlaylistCreator({ user, refreshPlaylists, playlist }) {
  const [name, setName] = useState(playlist ? playlist.name : "");
  const [image, setImage] = useState(null);
  const [isPublic, setIsPublic] = useState(playlist ? playlist.isPublic : true);
  const [msg, setMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg("Pon un nombre a la playlist");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("owner", user.username);
    formData.append("isPublic", isPublic);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("/playlists", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setMsg(`Playlist creada ✔️ ${!isPublic ? "(Privada - se generó link)" : ""}`);
        setName("");
        setImage(null);
        setIsPublic(true);
        refreshPlaylists();
      } else setMsg(data.error || "Error creando playlist");
    } catch {
      setMsg("Error creando playlist");
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Seguro que quieres borrar la playlist "${p.name}"?`)) return;
    setMsg("");
    try {
      const res = await fetch(`/playlists/${p._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (res.ok) {
        setMsg(`Playlist "${p.name}" eliminada ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error al borrar playlist");
      }
    } catch {
      setMsg("Error de conexión al borrar");
    }
  };

  const togglePrivacy = async (p) => {
    try {
      const res = await fetch(`/playlists/${p._id}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          isPublic: !p.isPublic,
        }),
      });

      if (res.ok) {
        setMsg(`Privacidad cambiada ✔️`);
        refreshPlaylists();
      } else {
        const data = await res.json();
        setMsg(data.error || "Error cambiando privacidad");
      }
    } catch {
      setMsg("Error de conexión");
    }
  };

  return (
    <>
      <div className="playlist-creator">
        <h3>Crear Playlist</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} />

        <label className="privacy-toggle">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span>{isPublic ? "🌍 Pública" : "🔒 Privada"}</span>
        </label>

        <button onClick={handleCreate}>Crear</button>
        {msg && <p>{msg}</p>}
      </div>

      {playlist && (
        <div className="playlist-actions">
          <button onClick={() => togglePrivacy(playlist)}>
            {playlist.isPublic ? "🔒 Hacer Privada" : "🌍 Hacer Pública"}
          </button>
          <button onClick={() => handleDelete(playlist)}>🗑️ Eliminar</button>
        </div>
      )}
    </>
  );
}

/* ==========================================================================================
  MAIN COMPONENT
========================================================================================== */
export default function Formulario() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  /* ================= AUTH STATE ================= */
  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email;

        const u = {
          username: firebaseUser.displayName || email.split("@")[0],
          email,
          avatar: firebaseUser.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
          isAdmin: email.endsWith("@gomusic"), // ✅ ADMIN
        };

        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
      } else {
        setUser(null);
        localStorage.removeItem("gomusic_user");
      }
    });
  }, []);

  /* ================= EMAIL / PASSWORD ================= */
  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const email = cred.user.email;

        setUser({
          username: cred.user.displayName || email.split("@")[0],
          email,
          avatar: cred.user.photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
          isAdmin: email.endsWith("@gomusic"), // ✅ ADMIN
        });

        setMessage("Sesión iniciada ✔");
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const email = cred.user.email;

        let photoURL = null;
        if (photoFile) {
          const refPath = ref(storage, `avatars/${cred.user.uid}`);
          await uploadBytes(refPath, photoFile);
          photoURL = await getDownloadURL(refPath);
        }

        await updateProfile(cred.user, {
          displayName: formData.username,
          photoURL,
        });

        setUser({
          username: formData.username,
          email,
          avatar: photoURL || null,
          isAdmin: email.endsWith("@gomusic"), // ✅ ADMIN
        });

        setMessage("Cuenta creada ✔");
      }

      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      setMessage(err.message);
    }
  };

  /* ================= GOOGLE LOGIN ================= */
  const handleGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const email = res.user.email;

      setUser({
        username: res.user.displayName,
        email,
        avatar: res.user.photoURL,
        isAdmin: email.endsWith("@gomusic"), // ✅ ADMIN
      });

      setMessage("Inicio con Google ✔");
    } catch (err) {
      console.error(err);
      setMessage("❌ Error con Google (revisa Firebase)");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="auth-container">
      {!user && (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          <div className="auth-form">
            {!isLogin && (
              <>
                <input
                  placeholder="Usuario"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
                <input type="file" onChange={(e) => setPhotoFile(e.target.files[0])} />
              </>
            )}

            <input
              placeholder="Correo"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button onClick={handleAuth}>{isLogin ? "Entrar" : "Registrar"}</button>
          </div>

          <button onClick={handleGoogle} className="google-btn">
            Google
          </button>

          {message && <p>{message}</p>}
        </>
      )}

      {user && (
        <>
          <div className="user-info-box">
            <img src={user.avatar} className="avatar-img" />
            <h3>{user.username}</h3>
            <p>{user.email}</p>

            {user.isAdmin && ( // ✅ ADMIN
              <a href="/admin" className="admin-btn">
                🛠 Panel Admin
              </a>
            )}

            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </>
      )}
    </div>
  );
}
