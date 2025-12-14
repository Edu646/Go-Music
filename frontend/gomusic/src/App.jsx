import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "./PlayerContext";

import Layout from "./layout";
import Inicio from "./inicio";
import Calculadora from "./calculadora";
import Formulario from "./formulario";
import Layout_Admin from "./Layout_Admin";
import Admin_Panel from "./Admin_Panel";
import Nav_Admin from "./Nav_Admin";
import Ejemplo from "./ejemplo";
import Chat from "./chat";
import Playlist_User from "./playlist_usuario";
import CancionesUsuarios from "./cancionesUsuarios";
import Usuarios from "./usuarios";

function App() {
  return (
    <PlayerProvider>
      <Router>
        <Routes>
          {/* 🌐 Layout general del sitio */}
          <Route element={<Layout />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/Calculadora" element={<Calculadora />} />
            <Route path="/playlist" element={<Playlist_User />} />
            <Route path="/Chat" element={<Chat username="User" />} />
            <Route path="/SESION" element={<Formulario />} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Route>

          {/* 🛠️ Layout exclusivo para el panel admin */}
          <Route element={<Layout_Admin />}>
            <Route path="/admin/songs" element={<CancionesUsuarios />} />
            <Route path="/admin/users" element={<Usuarios />} />
          </Route>
        </Routes>
      </Router>
    </PlayerProvider>
  );
}

export default App;