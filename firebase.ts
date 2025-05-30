// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore"; // Import Firestore

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD5kMuxS22zakgMxI1pQXBzDpDAH815E_4",
  authDomain: "myballot-app.firebaseapp.com",
  projectId: "myballot-app",
  storageBucket: "myballot-app.firebasestorage.app", // Corrected: .appspot.com is more common, but user provided .firebasestorage.app
  messagingSenderId: "308429515372",
  appId: "1:308429515372:web:109a94f959583191548649",
  measurementId: "G-PR6B53NDBP"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Optional: if you need analytics

// Initialize Firebase Authentication and get a reference to the service
const auth: Auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db: Firestore = getFirestore(app);

export { app, auth, db };
