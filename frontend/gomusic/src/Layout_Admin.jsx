import React from "react";
import { Outlet } from "react-router-dom";
import Nav_Admin from "./Nav_Admin";
import "./Layout_Admin.css";

export default function Layout_Admin() {
  return (
    <div className="layout-admin">
      <Nav_Admin />
      <div className="layout-content">
        <header>
          <h1>Panel de Administración</h1>
        </header>
        
        <main>
          <Outlet />
        </main>

        <footer>
          <p>© 2025 Go Music - Panel de Administración</p>
        </footer>
      </div>
    </div>
  );
}