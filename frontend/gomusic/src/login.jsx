import { useNavigate } from "react-router-dom";
import { setCurrentUser } from "./auth";

function Login() {
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState("");

  const handleLogin = () => {
    if (!usernameInput.trim()) return;
    setCurrentUser(usernameInput); // guarda en localStorage
    navigate("/chat"); // luego redirige al chat
  };

  return (
    <div>
      <input
        value={usernameInput}
        onChange={(e) => setUsernameInput(e.target.value)}
        placeholder="Escribe tu nombre"
      />
      <button onClick={handleLogin}>Entrar</button>
    </div>
  );
}

export default Login;
