import Nav_Admin from "./Nav_Admin";
import { Outlet } from "react-router-dom";
import "./Nav_Admin.css";

function Layout_Admin() {
  return (
    <div className="admin-layout">
      <Nav_Admin />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout_Admin;
