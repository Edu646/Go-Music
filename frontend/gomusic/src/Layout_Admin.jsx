// Layout_Admin.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Nav_Admin from "./Nav_Admin";
import "./Layout_Admin.css";

export default function Layout_Admin() {
  return (
    <div className="layout-admin">
      <Nav_Admin />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
