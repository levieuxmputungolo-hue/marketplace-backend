const firebaseConfig = {
  apiKey: "AIzaSyDbxXExuSaGCYN7B1oA3e8WnlFvQRNgFME",
  authDomain: "easy-market-96c4a.firebaseapp.com",
  projectId: "easy-market-96c4a",
  storageBucket: "easy-market-96c4a.firebasestorage.app",
  messagingSenderId: "69432010005",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  auth.useDeviceLanguage();
}
