import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate configuration
const isConfigValid = () => {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
};

// Initialize Firebase only if config is valid
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

try {
  if (isConfigValid()) {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Firebase] Missing configuration. Push notifications will not work.');
    }
  }
} catch (error) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Firebase] Failed to initialize:', error);
  }
}

export { app, messaging, getToken, onMessage };
