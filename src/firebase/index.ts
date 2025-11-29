import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';
import { useAuthState } from 'react-firebase-hooks/auth';

export function initializeFirebase(): { app: FirebaseApp; auth: Auth; firestore: Firestore } {
  if (getApps().length) {
    const app = getApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  return { app, auth, firestore };
}

export { FirebaseProvider, useFirebase, useAuth, useFirestore } from './provider';

export function useUser() {
    const { auth } = initializeFirebase();
    const [user, loading, error] = useAuthState(auth);
    return { user, loading, error };
}
