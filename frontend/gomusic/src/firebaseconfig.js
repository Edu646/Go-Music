import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth,
  GoogleAuthProvider 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC7vL_OXxTQ1wqsS_sKdYL-tuL2y-RFSac",
  authDomain: "go-music-c1fc5.firebaseapp.com",
  projectId: "go-music-c1fc5",
  storageBucket: "go-music-c1fc5.appspot.com",
  messagingSenderId: "254628632147",
  appId: "1:254628632147:web:9688356f8423ec95db58a6",
  measurementId: "G-02T7KM2T97"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// ✅ Usamos getAuth en lugar de initializeAuth
export const auth = getAuth(app);

// ✅ Configuramos el GoogleProvider correctamente
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;