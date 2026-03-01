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

      // 🔥 Si hay nueva imagen → subirla al backend
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

      // ✅ Ahora sí guardamos correctamente en Firebase
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

      // Persistir por UID
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
