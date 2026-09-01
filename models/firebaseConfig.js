import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// All config values must come from environment variables
// Fallbacks are provided for local development only
const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY            || "AIzaSyCQTkh6tsjLjuw6d6KaPetiNH2CriQxD7Q",
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || "scoresync-92994.firebaseapp.com",
  projectId:         process.env.FIREBASE_PROJECT_ID         || "scoresync-92994",
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || "scoresync-92994.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "518166819896",
  appId:             process.env.FIREBASE_APP_ID             || "1:518166819896:web:8155a8be113adb9adb62cd",
  measurementId:     process.env.FIREBASE_MEASUREMENT_ID     || "G-R9WJWV7KWR",
};

// Prevent duplicate app initialization (important for Vercel serverless warm starts)
let app, db, auth;
try {
  app  = initializeApp(firebaseConfig);
  db   = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  // App already initialized — reuse existing instance
  const { getApps } = await import("firebase/app");
  app  = getApps()[0];
  db   = getFirestore(app);
  auth = getAuth(app);
}

export { db, auth, firebaseConfig };
