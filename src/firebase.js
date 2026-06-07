import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCypfO7EWAXVGsEdhjCZKW35t5GZH8kA9I",
  authDomain: "bugetbuddy-b7cdb.firebaseapp.com",
  projectId: "bugetbuddy-b7cdb",
  storageBucket: "bugetbuddy-b7cdb.firebasestorage.app",
  messagingSenderId: "692785847855",
  appId: "1:692785847855:web:1225d32245d68cd91630da",
  measurementId: "G-85QT55780J"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)
export default app
