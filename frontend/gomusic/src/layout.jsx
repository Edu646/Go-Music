import React from "react";
import Navbar from "./navbar";
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div>
      <Navbar />
      <main style={{ padding: "20px" }}>
        <Outlet /> {/* Aquí se renderizan las páginas */}
      </main>
    </div>
  );
}

export default Layout;
