// src/auth.js
export const getCurrentUser = () => {
  return localStorage.getItem("username") || null;
};

export const setCurrentUser = (username) => {
  localStorage.setItem("username", username);
};

export const logoutUser = () => {
  localStorage.removeItem("username");
};
