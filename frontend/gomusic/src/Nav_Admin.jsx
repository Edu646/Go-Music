import React from "react";
import { NavLink } from "react-router-dom";
import "./Nav_Admin.css";

export default function Nav_Admin() {
  return (
    <nav className="nav-admin">
      
      {/* TÍTULO CLICKEABLE */}
      <div className="nav-admin-header">
        <NavLink to="/admin" className="nav-admin-title">
          Panel administrador
        </NavLink>
      </div>

      <ul className="nav-admin-links">

        <li>
          <NavLink to="/admin/songs">
            <span className="icon">🎵</span>
            <span>Canciones</span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/admin/users">
            <span className="icon">👥</span>
            <span>Usuarios</span>
          </NavLink>
        </li>

      </ul>

      {/* BOTÓN IR A LA WEB */}
      <div className="nav-admin-footer">
        <a
          href="https://go-music-3mgo.onrender.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-admin-website"
        >
          🌍 Ir a GoMusic
        </a>
      </div>

    </nav>
  );
}
