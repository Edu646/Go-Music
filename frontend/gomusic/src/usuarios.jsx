import React, { useEffect, useState } from "react";
import "./usuarios.css";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://go-music-3mgo.onrender.com/users")
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
      const res = await fetch(`https://go-music-3mgo.onrender.com/users/${username}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Error eliminando usuario");

      setUsers(users.filter(u => u !== username));
    } catch (err) {
      alert("❌ No se pudo eliminar el usuario");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="admin-users-container">
        <p className="loading-message">Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="admin-users-container">
      <h2>👤 Usuarios registrados</h2>

      {users.length === 0 ? (
        <p className="no-users-message">No hay usuarios registrados</p>
      ) : (
        <ul className="users-list">
          {users.map(user => (
            <li key={user} className="user-item">
              <span className="user-name">{user}</span>
              <button
                className="delete-button"
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

export default AdminUsers;