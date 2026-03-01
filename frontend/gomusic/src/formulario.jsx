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
  PERFIL PERSISTENTE POR USUARIO
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
  PROFILE EDITOR (ARREGLADO)
========================================================================================== */

function ProfileEditor({ user, setUser, setMessage }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user.avatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName || "");
    setPhotoPreview(user.avatar);
  }, [user, editing]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setMessage("No hay usuario autenticado");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let photoURL = user.avatar;

      if (photoFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", photoFile);

        const res = await fetch("/upload-avatar", {
          method: "POST",
          body: uploadFormData,
        });

        const data = await res.json();

        if (res.ok && data.url) {
          photoURL = data.url;
        } else {
          throw new Error(data.error || "Error subiendo imagen");
        }
      }

      const finalDisplayName = displayName?.trim()
        ? displayName.trim()
        : user.displayName || user.username;

      await updateProfile(fbUser, {
        displayName: finalDisplayName,
        photoURL: photoURL,
      });

      const updated = {
        ...user,
        displayName: finalDisplayName,
        avatar: photoURL,
      };

      setUser(updated);
      localStorage.setItem("gomusic_user", JSON.stringify(updated));

      if (fbUser?.uid) {
        saveProfile(fbUser.uid, {
          displayName: updated.displayName,
          avatar: updated.avatar,
        });
      }

      setMessage("Perfil actualizado ✔");
      setEditing(false);
      setPhotoFile(null);
    } catch (err) {
      console.error("Error actualizando perfil:", err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-editor">
      <button className="btn-action" onClick={() => setEditing(!editing)}>
        {editing ? "Cancelar" : "✏️ Editar perfil"}
      </button>

      {editing && (
        <div className="profile-editor-box">
          <div className="profile-preview">
            <img src={photoPreview} alt="Preview" className="avatar-preview" />
          </div>

          <input
            type="text"
            placeholder="Nombre de perfil"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <input type="file" accept="image/*" onChange={handleFileChange} />

          <button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </div>
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

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});

    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const storedProfile = loadProfile(uid);

        const username = firebaseUser.displayName || firebaseUser.email.split("@")[0];
        const displayName =
          storedProfile?.displayName || firebaseUser.displayName || username;

        const avatar =
          storedProfile?.avatar ||
          firebaseUser.photoURL ||
          "https://i.ibb.co/4pDNDk1/avatar-default.png";

        const u = {
          uid,
          username,
          displayName,
          email: firebaseUser.email,
          avatar,
        };

        setUser(u);
        localStorage.setItem("gomusic_user", JSON.stringify(u));
        saveProfile(uid, { displayName, avatar });
      } else {
        setUser(null);
        localStorage.removeItem("gomusic_user");
      }
    });
  }, []);

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

        setMessage("Sesión iniciada ✔");
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        let photoURL = null;

        if (photoFile) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", photoFile);

          const res = await fetch("/upload-avatar", {
            method: "POST",
            body: uploadFormData,
          });

          const data = await res.json();
          if (res.ok && data.url) {
            photoURL = data.url;
          }
        }

        await updateProfile(cred.user, {
          displayName: formData.username,
          photoURL: photoURL,
        });

        setMessage("Cuenta creada ✔");
      }

      setFormData({ username: "", email: "", password: "" });
      setPhotoFile(null);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      await signInWithRedirect(auth, googleProvider);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMessage("");
  };

  return (
    <div className="auth-container">
      {!user && (
        <>
          <h2>{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>

          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Nombre"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files[0])}
              />
            </>
          )}

          <input
            type="email"
            placeholder="Correo"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <button onClick={handleAuth}>
            {isLogin ? "Entrar" : "Registrar"}
          </button>

          <button onClick={handleGoogle}>Continuar con Google</button>

          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Crear cuenta" : "Iniciar sesión"}
          </button>

          {message && <p>{message}</p>}
        </>
      )}

      {user && (
        <>
          <div className="user-info-box">
            <img src={user.avatar} alt="Avatar" className="avatar-img" />
            <h3>{user.displayName}</h3>
            <p>{user.email}</p>
            <button onClick={handleLogout}>Cerrar sesión</button>
            <ProfileEditor user={user} setUser={setUser} setMessage={setMessage} />
          </div>

          {message && <p>{message}</p>}
        </>
      )}
    </div>
  );
}
