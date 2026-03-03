import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "./firebaseconfig";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import "./formulario.css";

/* =========================
   AVATAR POR DEFECTO
========================= */
const DEFAULT_AVATAR =
  "https://i.ibb.co/4pDNDk1/avatar-default.png";

/* =========================
   COMPONENTE SONG LIST
========================= */
function SongList({ songs, search, setSearch, refreshSongs }) {
  return (
    <div className="song-list">
      <h3>Buscar canciones ({songs.length})</h3>

      <input
        placeholder="Nombre o artista"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <button onClick={refreshSongs}>Recargar</button>

      <ul>
        {songs.length ? (
          songs.map((s, i) => (
            <li key={s._id || i}>
              <b>{s.name}</b> - {s.artist}
            </li>
          ))
        ) : (
          <p>Sin canciones</p>
        )}
      </ul>
    </div>
  );
}

/* =========================
   COMPONENTE PRINCIPAL
========================= */
export default function Formulario() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");

  /* =========================
     FETCH CANCIONES
  ========================= */
  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch(
        search ? `/search?q=${encodeURIComponent(search)}` : "/songs"
      );
      const data = await res.json().catch(() => []);
      setSongs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching songs:", e);
    }
  }, [search]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  /* =========================
     LISTENER FIREBASE
  ========================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const username =
          firebaseUser.displayName ||
          firebaseUser.email.split("@")[0];

        const u = {
          uid: firebaseUser.uid,
          username,
          displayName:
            firebaseUser.displayName || username,
          email: firebaseUser.email,
          avatar:
            firebaseUser.photoURL || DEFAULT_AVATAR,
        };

        setUser(u);
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  /* =========================
     LOGIN / REGISTER
  ========================= */
  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        const u = {
          uid: cred.user.uid,
          username: cred.user.email.split("@")[0],
          displayName:
            cred.user.displayName ||
            cred.user.email.split("@")[0],
          email: cred.user.email,
          avatar:
            cred.user.photoURL || DEFAULT_AVATAR,
        };

        setUser(u);
        setMessage("Sesión iniciada ✔");
      } else {
        const cred =
          await createUserWithEmailAndPassword(
            auth,
            formData.email,
            formData.password
          );

        await updateProfile(cred.user, {
          displayName: formData.username,
        });

        const u = {
          uid: cred.user.uid,
          username:
            cred.user.email.split("@")[0],
          displayName: formData.username,
          email: cred.user.email,
          avatar: DEFAULT_AVATAR,
        };

        setUser(u);
        setMessage("Cuenta creada ✔");
      }

      setFormData({
        username: "",
        email: "",
        password: "",
      });
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  /* =========================
     GOOGLE LOGIN
  ========================= */
  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setMessage(
        `Error Google: ${error.message}`
      );
    }
  };

  /* =========================
     LOGOUT
  ========================= */
  const handleLogout = async () => {
    await signOut(auth);
    setMessage("");
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage("");
  };

  /* =========================
     🔥 DETECTOR ADMIN
  ========================= */
  const isAdmin =
    user?.email?.toLowerCase().includes("@gomusic");

  return (
    <div className="auth-container">
      {!user && (
        <>
          <h2>
            {isLogin
              ? "Iniciar sesión"
              : "Crear cuenta"}
          </h2>

          <div className="auth-form">
            {!isLogin && (
              <input
                type="text"
                placeholder="Nombre"
                value={formData.username}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    username: e.target.value,
                  })
                }
              />
            )}

            <input
              type="email"
              placeholder="Correo"
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
            />

            <button onClick={handleAuth}>
              {isLogin
                ? "Entrar"
                : "Registrar"}
            </button>
          </div>

          <button
            onClick={handleGoogle}
            className="google-btn"
          >
            Continuar con Google
          </button>

          <button
            onClick={toggleForm}
            className="auth-toggle"
          >
            {isLogin
              ? "Crear cuenta"
              : "Iniciar sesión"}
          </button>

          {message && (
            <p className="message">
              {message}
            </p>
          )}
        </>
      )}

      {user && (
        <>
          <div className="user-info-box">
            <img
              src={
                user.avatar ||
                DEFAULT_AVATAR
              }
              alt="Avatar"
              className="avatar-img"
            />

            <h3>
              {user.displayName ||
                user.username}
            </h3>

            <p>{user.email}</p>

            <button onClick={handleLogout}>
              Cerrar sesión
            </button>

            {isAdmin && (
              <button
                className="btn-admin"
                onClick={() =>
                  (window.location.href =
                    "/admin")
                }
              >
                🛠 Ir a Admin
              </button>
            )}
          </div>

          {message && (
            <p className="message">
              {message}
            </p>
          )}

          <SongList
            songs={songs}
            search={search}
            setSearch={setSearch}
            refreshSongs={fetchSongs}
          />
        </>
      )}
    </div>
  );
}
