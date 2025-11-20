// src/auth.js
export const getCurrentUser = () => {
  const u = localStorage.getItem("gomusic_user");
  return u ? JSON.parse(u).username : null; // devuelve solo el username
};

export const setCurrentUser = (userObj) => {
  localStorage.setItem("gomusic_user", JSON.stringify(userObj));
};

export const logoutUser = () => {
  localStorage.removeItem("gomusic_user");
};
