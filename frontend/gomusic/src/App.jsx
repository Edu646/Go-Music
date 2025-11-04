import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./PlayerContext";

import Layout from "./layout";         // 🧭 Layout general con el navbar principal
import Inicio from "./inicio";
import Calculadora from "./calculadora";
import Formulario from "./formulario";
import Layout_Admin from "./Layout_Admin"; // 🧭 Layout exclusivo del admin
import Admin_Panel from "./Admin_Panel";
import Nav_Admin from "./Nav_Admin";

function App() {
  return (
    <PlayerProvider>
      <Router>
        <Routes>
          {/* 🌐 Layout general del sitio */}
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route path="/playlist" element={<div>Playlist Page</div>} />
            <Route path="/about" element={<div>About Page</div>} />
            <Route path="/SESION" element={<Formulario />} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Route>

          {/* 🛠️ Layout exclusivo para el panel admin */}
          <Route
            path="/admin/*"
            element={
              <Layout_Admin>
                <Nav_Admin /> {/* 👈 Navbar diferente para el admin */}
                <Admin_Panel />
              </Layout_Admin>
            }
          />
        </Routes>
      </Router>
    </PlayerProvider>
  );
}

export default App;
