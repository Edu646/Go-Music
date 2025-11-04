import React from "react";
import "./Admin_Panel.css";
import Layout_Admin from "./Layout_Admin";
import Nav_Admin from "./Nav_Admin";
function Admin_Panel() {
  return (
    
    <Layout_Admin>
      <div className="admin-container">
        <h2>Panel de Administración</h2>
        <p>Bienvenido al panel de administración. Aquí puedes gestionar el contenido de la aplicación.</p>
      </div>
    </Layout_Admin>
  );
}

export default Admin_Panel;
