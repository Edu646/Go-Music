import React, { useState, useEffect, useCallback } from "react";
import { auth, googleProvider } from "./firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import "./formulario.css";

/* ==========================================================================================
  PERFIL PERSISTENTE POR USUARIO (NO se borra al cerrar sesión)
========================================================================================== */
const PROFILE_STORE_KEY = "gomusic_profiles_v1";

function loadProfile(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map?.[uid] || null;
  } catch {
    return null;
  }
}

function saveProfile(uid, data) {
  try {
    const raw = localStorage.getItem(PROFILE_STORE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[uid] = { ...(map[uid] || {}), ...data };
    localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(map));
  } catch {}
}

/* ==========================================================================================
  COMPONENTES DE PLAYLIST, CANCIÓN Y PERFIL
========================================================================================== */
// Aquí van PlaylistActions, RemoveFromLibrary, PlaylistCreator, PlaylistShare, ShareAcceptor,
// SongActions, ProfileEditor, SongList, FormularioSubida
// (copiar exactamente como los tenías; no los borro para no romper nada)

...

/* ==========================================================================================
  MAIN COMPONENT - FORMULARIO
========================================================================================== */
export default function Formulario() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [ownPlaylists, setOwnPlaylists] = useState([]);
  const [sharedPlaylists, setSharedPlaylists] = useState([]);
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);

  /* ========================== FETCH SONGS ========================== */
  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch(search ? `/search?q=${search}` : "/songs");
      setSongs(await res.json());
    } catch (e) {
      console.error("Error fetching songs:", e);
    }
  }, [search]);

  /* ========================== FETCH PLAYLISTS ========================== */
  const fetchPlaylists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/playlists/${user.username}`);
      const data = await res.json();
      setOwnPlaylists(data.own || []);
      setSharedPlaylists(data.shared || []);
    } catch (e) {
      console.error("Error fetching playlists:", e);
    }
  }, [user]);

  /* ========================== EFFECT: GOOGLE REDIRECT & ONAUTHSTATE ========================== */
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const uid = result.user.uid;
          const storedProfile = loadProfile(uid);

          const username = result.user.displayName || result.user.email.split("@")[0];
          const displayName = storedProfile?.displayName || result.user.displayName || username;
          const avatar =
            storedProfile?.avatar ||
            result.user.photoURL ||
            "https://i.ibb.co/4pDNDk1/avatar-default.png";

          const u = { uid, username, displayName, email: result.user.email, avatar };
          setUser(u);
          localStorage.setItem("gomusic_user", JSON.stringify(u));
          saveProfile(uid, { displayName, avatar });
          setMessage("Inicio con Google ✔");
        }
      })
      .catch((error) => {
        console.error("Error en redirect de Google:", error);
        setMessage(`Error Google: ${error.code} - ${error.message}`);
      });

    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const storedProfile = loadProfile(uid);

        const username = firebaseUser.displayName || firebaseUser.email.split("@")[0];
        const displayName = storedProfile?.displayName || firebaseUser.displayName || username;
        const avatar =
          storedProfile?.avatar ||
          firebaseUser.photoURL ||
          "https://i.ibb.co/4pDNDk1/avatar-default.png";

        const u = { uid, username, displayName, email: firebaseUser.email, avatar };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(uid, { displayName, avatar });
      } else {
        setUser(null);
        // No borrar la info persistente por UID, solo la sesión actual
      }
    });
  }, []);

  /* ========================== AUTH HANDLER ========================== */
  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, formData.email, formData.password);

        const uid = cred.user.uid;
        const storedProfile = loadProfile(uid);

        const username = cred.user.displayName || cred.user.email.split("@")[0];
        const displayName = storedProfile?.displayName || cred.user.displayName || username;
        const avatar =
          storedProfile?.avatar ||
          cred.user.photoURL ||
          "https://i.ibb.co/4pDNDk1/avatar-default.png";

        const u = { uid, username, displayName, email: cred.user.email, avatar };
        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(uid, { displayName, avatar });

        setMessage("Sesión iniciada ✔");
      } else {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

        let photoURL = null;
        if (photoFile) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", photoFile);
          try {
            const res = await fetch("/upload-avatar", { method: "POST", body: uploadFormData });
            const data = await res.json();
            if (res.ok && data.url) photoURL = data.url;
          } catch (err) {
            console.error("Error uploadando avatar:", err);
          }
        }

        await updateProfile(cred.user, { displayName: formData.username, photoURL });

        const u = {
          uid: cred.user.uid,
          username: cred.user.email.split("@")[0],
          displayName: formData.username,
          email: cred.user.email,
          avatar: photoURL || "https://i.ibb.co/4pDNDk1/avatar-default.png",
        };

        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(u.uid, { displayName: u.displayName, avatar: u.avatar });

        setMessage("Cuenta creada ✔");
      }

      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      console.error("Error en autenticación:", err);
      setMessage(`Error: ${err.message}`);
    }
  };

  /* ========================== LOGOUT ========================== */
  const handleLogout = async () => {
    await signOut(auth);
    setShowPlaylistCreator(false);
    setMessage("");
    setUser(null);
    // No borrar la info persistente por UID para que el avatar se quede guardado
  };

  /* ========================== GOOGLE POPUP ========================== */
  const handleGoogle = async () => {
    setMessage("Redirigiendo a Google...");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error en popup, intentando redirect:", error);
      if (error.code === "auth/popup-blocked" || error.code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Error en redirect:", redirectError);
          setMessage(`Error: ${redirectError.code} - ${redirectError.message}`);
        }
      } else {
        setMessage(`Error Google: ${error.code} - ${error.message}`);
      }
    }
  };

  // ... resto del return con UI (no tocar nada aquí, copiar tu código original)
}
