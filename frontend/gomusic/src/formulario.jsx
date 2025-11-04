import React, { useState } from "react";
import "./formulario.css";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC7vL_OXxTQ1wqsS_sKdYL-tuL2y-RFSac",
  authDomain: "go-music-c1fc5.firebaseapp.com",
  projectId: "go-music-c1fc5",
  storageBucket: "go-music-c1fc5.firebasestorage.app",
  messagingSenderId: "254628632147",
  appId: "1:254628632147:web:9688356f8423ec95db58a6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(isLogin
      ? `Iniciando sesión con ${formData.email}`
      : `Creando cuenta con ${formData.username} - ${formData.email}`);
  }

  const toggleForm = () => {
    setIsLogin(!isLogin);
  }

  const handleGoogleLogin = () => {
    alert("Autenticación con Google");
  }

  return (
    <div className="auth-container">
      <h2 className="auth-title">Bienvenido</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        {!isLogin && (
          <input
            type="text"
            name="username"
            placeholder="Nombre de usuario"
            value={formData.username}
            onChange={handleChange}
            className="auth-input"
            required
          />
        )}
        <input
          type="email"
          name="email"
          placeholder="Correo electrónico"
          value={formData.email}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          value={formData.password}
          onChange={handleChange}
          className="auth-input"
          required
        />
        <button type="submit" className="auth-button">
          {isLogin ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>

      <button className="google-btn" onClick={handleGoogleLogin}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/512px-Google_%22G%22_Logo.svg.png" alt="Google logo" className="google-icon"/>
        Continuar con Google
      </button>

      <div className="auth-toggle" onClick={toggleForm}>
        {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <span className="toggle-span">{isLogin ? "Crear cuenta" : "Inicia sesión"}</span>
      </div>
    </div>
  )
}

export default AuthForm;
