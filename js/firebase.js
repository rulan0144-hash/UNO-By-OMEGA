// Koneksi Firebase. Isi config di bagian MY_FIREBASE_CONFIG.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
export { signInAnonymously, signInWithCustomToken, doc, setDoc, getDoc, updateDoc, onSnapshot };

// ====== ISI CONFIG FIREBASE KAMU DI SINI (untuk GitHub Pages) ======
export const MY_FIREBASE_CONFIG = {
    apiKey: "AIzaSyB_HWSLl4qM2Y_pjWcz8Mc7fvgVC4woe3A",
    authDomain: "uno-by-omega.firebaseapp.com",
    projectId: "uno-by-omega",
    storageBucket: "uno-by-omega.firebasestorage.app",
    messagingSenderId: "95793387235",
    appId: "1:95793387235:web:e852bf3d6a3357f360d7d6"
};

// ====================================================================

export const appId = typeof __app_id !== 'undefined' ? __app_id : 'uno-app';

export const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : MY_FIREBASE_CONFIG;

export const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export const hasFirebase = !!firebaseConfig.apiKey;

export let auth, db;
if (hasFirebase) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

export const roomDoc = (code) => doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
