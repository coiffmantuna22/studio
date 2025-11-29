'use client';

import React, { createContext, useContext } from 'react';
import { initializeFirebase } from './index';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const firebase = initializeFirebase();
  return (
    <FirebaseContext.Provider value={firebase}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  return useContext(FirebaseContext) as FirebaseContextValue;
};

export const useAuth = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useAuth must be used within a FirebaseProvider');
    }
    return { auth: context.auth };
}

export const useFirestore = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useFirestore must be used within a FirebaseProvider');
    }
    return context.firestore;
}
