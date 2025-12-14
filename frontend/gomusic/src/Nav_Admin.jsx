import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Nav_Admin.css";

export default function Nav_Admin() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <nav className={`nav-admin ${isCollapsed ? "collapsed" : ""}`}>
      <div className="nav-admin-left">
        <h1 className="nav-admin-title">
          {!isCollapsed ? "Admin Panel" : "AP"}
        </h1>

        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      <ul className="nav-admin-links">

        <li>
          <NavLink to="/admin/songs">
            <span className="icon">🎵</span>
            <span className="text">Canciones</span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/admin/users">
            <span className="icon">👥</span>
            <span className="text">Usuarios</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
