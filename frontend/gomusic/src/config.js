const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://tu-backend.onrender.com"; // ← tu URL de Render

export default API_URL;
