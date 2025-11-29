
import { WriteBatch, Firestore } from 'firebase/firestore';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface BatchContext {
  operation: 'create' | 'update' | 'delete';
  path: string;
  firestore: Firestore;
  data?: any;
}

export function commitBatchWithContext(batch: WriteBatch, context: BatchContext): Promise<void> {
  return batch.commit().catch(error => {
    const permissionError = new FirestorePermissionError({
      operation: context.operation,
      path: context.path,
      requestResourceData: context.data,
    });
    errorEmitter.emit('permission-error', permissionError);
    // Also throw the error to stop execution flow on permission issues
    throw permissionError;
  });
}
