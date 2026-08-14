import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Config comes from Netlify / .env vars, which is what
 * `firebase apps:sdkconfig web` prints. When they are absent the app falls
 * back to browser-local storage so it stays fully usable offline and in dev
 * (see storage.ts).
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId)

let app: FirebaseApp | null = null
let db: Firestore | null = null

export function getDb(): Firestore | null {
  if (!isFirebaseConfigured) return null
  if (!db) {
    app = initializeApp(config as Required<typeof config>)
    db = getFirestore(app)
  }
  return db
}
