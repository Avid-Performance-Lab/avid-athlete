import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA246P9MlXT2ayCYD10QYuZ9t-A9zl86h0",
  authDomain: "avid-performance-lab.firebaseapp.com",
  projectId: "avid-performance-lab",
  storageBucket: "avid-performance-lab.firebasestorage.app",
  messagingSenderId: "110270991181",
  appId: "1:110270991181:web:5f73e852b90c4935570504",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
