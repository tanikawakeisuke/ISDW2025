import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Check if Firebase is disabled for testing
const isFirebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only on client side and when not disabled
let app: any = null;
let auth: any = null;
let db: any = null;

if (typeof window !== 'undefined' && !isFirebaseDisabled) {
  try {
    // Check if Firebase app is already initialized
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    // Continue without Firebase
  }
}

// Export with fallbacks for SSR
export { auth, db };

// Anonymous authentication helper
export const signInAnonymouslyHelper = async () => {
  if (!auth || isFirebaseDisabled) {
    throw new Error('Firebase is disabled or not initialized');
  }
  
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Anonymous sign-in failed:', error);
    throw error;
  }
};

export default app;