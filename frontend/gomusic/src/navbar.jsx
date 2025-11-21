import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./navbar.css";
import logo from "./imagenes/logo.png";

function Navbar() {
  // 1. Usamos useState para manejar el estado del menú móvil
  const [isOpen, setIsOpen] = useState(false);

  // 2. Función para alternar el estado del menú
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // 3. Función para cerrar el menú después de hacer clic en un enlace
  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    // 4. Aplicamos la clase 'open' a la nav si el estado isOpen es true
    <nav className={`navbar ${isOpen ? "open" : ""}`}>
      <div className="logo">
        <img src={logo} alt="Mi App Música" className="logo-img" />
      </div>

      {/* 5. Lista de enlaces */}
      <ul className="nav-links">
        <li>
          {/* Al hacer clic, cerramos el menú */}
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeMenu}
          >
            Inicio
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/calculadora"
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeMenu}
          >
            Buscar
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/playlist"
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeMenu}
          >
            Playlist
          </NavLink>
        </li>
        <li>
          <Link to="/Chat" onClick={closeMenu}>
            Chat
          </Link>
        </li>
        <li>
          <Link to="/SESION" onClick={closeMenu}>
            Inicio de Sesión
          </Link>
        </li>
      </ul>

      {/* 6. Botón Hamburguesa/Cerrar */}
      {/* Añadimos el icono y el manejador de clic para alternar el estado */}
      <button className="nav-toggle" onClick={toggleMenu} aria-label="Toggle navigation">
        {isOpen ? (
          // Icono 'X' (cerrar)
          <i className="fas fa-times"></i>
        ) : (
          // Icono '☰' (hamburguesa/abrir)
          <i className="fas fa-bars"></i>
        )}
      </button>
    </nav>
  );
}

export default Navbar;