// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBK9gxEpAfootaBY0MM0Gq-7uSG76k0Qt4",
    authDomain: "simplegame-dev-fdb.firebaseapp.com",
    projectId: "simplegame-dev-fdb",
    storageBucket: "simplegame-dev-fdb.firebasestorage.app",
    messagingSenderId: "637458062186",
    appId: "1:637458062186:web:e2d48a3f6d8cfc6f126313"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);