import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Nav_Admin.css";
import Usuarios from "./usuarios.jsx";
import CancionesUsuarios from "./cancionesUsuarios.jsx";
export default function Nav_Admin() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <nav className={`nav-admin ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="nav-admin-left">
        <h1 className="nav-admin-title">
          {!isCollapsed ? 'Admin Panel' : 'AP'}
        </h1>
        <button 
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      <ul className="nav-admin-links">
        <li><NavLink to="/admin" end><span className="icon">🏠</span><span className="text">Dashboard</span></NavLink></li>
        <li><CancionesUsuarios to="/admin/songs"><span className="icon">🎵</span><span className="text">Canciones</span></CancionesUsuarios></li>
        <li><Usuarios to="/admin/users"><span className="icon">👥</span><span className="text">Usuarios</span></Usuarios></li>
        <li><button className="nav-admin-logout"><span className="icon">🚪</span><span className="text">Cerrar sesión</span></button></li>
      </ul>
    </nav>
  );
}