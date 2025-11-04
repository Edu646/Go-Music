import React from "react";
import { Link, NavLink } from "react-router-dom";
import "./navbar.css";
import logo from "./imagenes/logo.png"

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo"> <img src={logo} alt="Mi App Música" className="logo-img" /></div>
      <ul className="nav-links">
        <li>
          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Inicio</NavLink>
        </li>
        <li>
          <NavLink to="/calculadora" className={({ isActive }) => isActive ? "active" : ""}>Buscar</NavLink>
        </li>
        <li>
          <NavLink to="/playlist" className={({ isActive }) => isActive ? "active" : ""}>Playlist</NavLink>
        </li>
        <li>
          <Link to="/about">Chat </Link>
        </li>

        <li>
          <Link to="/SESION"> Inicio de Sesión</Link>
        </li>

      </ul>
    </nav>
  );
}

export default Navbar;
