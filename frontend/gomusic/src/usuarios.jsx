import React, { useEffect, useState } from "react";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://go-music-3mgo.onrender.com//users")
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error cargando usuarios:", err);
        setLoading(false);
      });
  }, []);

  const deleteUser = async (username) => {
    if (!window.confirm(`¿Eliminar al usuario ${username}?`)) return;

    try {
      const res = await fetch(`https://go-music-3mgo.onrender.com//users/${username}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Error eliminando usuario");

      setUsers(users.filter(u => u !== username));
    } catch (err) {
      alert("❌ No se pudo eliminar el usuario (falta backend)");
      console.error(err);
    }
  };

  if (loading) return <p>Cargando usuarios...</p>;

  return (
    <div style={styles.container}>
      <h2>👤 Usuarios registrados</h2>

      {users.length === 0 ? (
        <p>No hay usuarios</p>
      ) : (
        <ul style={styles.list}>
          {users.map(user => (
            <li key={user} style={styles.item}>
              <span>{user}</span>
              <button
                style={styles.delete}
                onClick={() => deleteUser(user)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: 600,
    margin: "40px auto",
    color: "#fff"
  },
  list: {
    listStyle: "none",
    padding: 0
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    borderBottom: "1px solid #333"
  },
  delete: {
    background: "#e53935",
    border: "none",
    color: "white",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer"
  }
};

export default AdminUsers;
