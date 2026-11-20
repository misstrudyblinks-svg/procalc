// ProCalc Firebase setup. Firebase client config is safe to include in a web app;
// protect your data with Authentication and Firestore Security Rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_6V8xtXpx8EoINrOtj1CPZS5vylbImxA",
  authDomain: "prohcul.firebaseapp.com",
  projectId: "prohcul",
  storageBucket: "prohcul.firebasestorage.app",
  messagingSenderId: "34922537551",
  appId: "1:34922537551:web:e3e59dc90210dfe523003a",
  measurementId: "G-4XKFNCLN3Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
