import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Web config is safe to commit: it only identifies the project.
// Access is controlled by firestore.rules, not by hiding these values.
const firebaseConfig = {
  apiKey: 'AIzaSyAy5-vPySKvNna8be6HLc6hFbJkoveiBWo',
  authDomain: 'timethreads.firebaseapp.com',
  projectId: 'timethreads',
  storageBucket: 'timethreads.firebasestorage.app',
  messagingSenderId: '36227753431',
  appId: '1:36227753431:web:96ef7ec9601700a2551792',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
