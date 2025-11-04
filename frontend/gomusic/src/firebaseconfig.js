import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7vL_OXxTQ1wqsS_sKdYL-tuL2y-RFSac",
  authDomain: "go-music-c1fc5.firebaseapp.com",
  projectId: "go-music-c1fc5",
  storageBucket: "go-music-c1fc5.firebasestorage.app",
  messagingSenderId: "254628632147",
  appId: "1:254628632147:web:9688356f8423ec95db58a6",
  measurementId: "G-02T7KM2T97"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);