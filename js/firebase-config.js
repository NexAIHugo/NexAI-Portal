// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBlV4Hm4kVs2ZuwEHGywR8qFDRbgYky4vA",
  authDomain: "nexai-hub.firebaseapp.com",
  projectId: "nexai-hub",
  storageBucket: "nexai-hub.firebasestorage.app",
  messagingSenderId: "143241275721",
  appId: "1:143241275721:web:0ab714ada082ebb5e11298",
  measurementId: "G-BSF10XWRPQ"
};

// Initialize Firebase (compat mode)
firebase.initializeApp(firebaseConfig);

window.firebaseAuth = firebase.auth();
window.firebaseDb = firebase.firestore();
try {
  window.firebaseStorage = firebase.storage();
} catch (e) {
  console.warn("Firebase Storage SDK not loaded or failed to initialize:", e);
  window.firebaseStorage = null;
}
window.googleProvider = new firebase.auth.GoogleAuthProvider();
window.googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
window.googleProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

console.log('🔥 NexAI Hub: Firebase Initialized (compat mode)');
