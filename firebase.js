// 1) Go to https://console.firebase.google.com → Create a project (free, no card needed)
// 2) Inside the project: Build → Firestore Database → Create database → Start in test mode
// 3) Project settings (⚙️) → Your apps → Web app (</>) → register it → copy the config below
// 4) Paste your own values here, replacing every "REPLACE_ME"

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD3agpC87Pygu640BztbfWKKGRN9qqNK64",
  authDomain: "modren-bank.firebaseapp.com",
  projectId: "modren-bank",
  storageBucket: "modren-bank.firebasestorage.app",
  messagingSenderId: "595053327900",
  appId: "1:595053327900:web:9506f097c7a3e7c4f051d9",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
