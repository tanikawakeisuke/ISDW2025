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

// Initialize Firebase with proper validation
let app: any = null;
let auth: any = null;
let db: any = null;

// Helper function to initialize Firebase
function initializeFirebaseApp() {
  if (isFirebaseDisabled) {
    console.log('Firebase is disabled for testing');
    return null;
  }

  // Validate required config
  if (!firebaseConfig.apiKey || 
      !firebaseConfig.authDomain || 
      !firebaseConfig.projectId ||
      firebaseConfig.apiKey === 'your_api_key_here') {
    console.warn('Firebase config incomplete or using placeholder values');
    return null;
  }

  try {
    // Check if Firebase app is already initialized
    const existingApp = getApps().find(app => app.name === '[DEFAULT]');
    if (existingApp) {
      return existingApp;
    }
    
    return initializeApp(firebaseConfig);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return null;
  }
}

// Initialize on client side only
if (typeof window !== 'undefined') {
  app = initializeFirebaseApp();
  
  if (app) {
    try {
      auth = getAuth(app);
      db = getFirestore(app);
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase services initialization failed:', error);
      auth = null;
      db = null;
    }
  }
}

// Export with null safety
export { auth, db };

// Helper to check if Firebase is available
export const isFirebaseAvailable = () => {
  return !isFirebaseDisabled && db !== null && auth !== null;
};

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