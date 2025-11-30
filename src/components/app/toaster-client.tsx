'use client';

import { Toaster } from '@/components/ui/toaster';
import { useAuth, useFirestore } from '@/firebase';
import { useEffect } from 'react';
import { doc, writeBatch, collection, setDoc } from 'firebase/firestore';

export default function ToasterClient() {
    const auth = useAuth();
    const firestore = useFirestore();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.auth = auth;
            // @ts-ignore
            window.firestore = firestore;
            // @ts-ignore
            window.doc = doc;
            // @ts-ignore
            window.writeBatch = writeBatch;
            // @ts-ignore
            window.collection = collection;
            // @ts-ignore
            window.setDoc = setDoc;
        }
    }, [auth, firestore]);

    return <Toaster />;
}
