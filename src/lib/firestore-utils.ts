
import { WriteBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface BatchContext {
  operation: 'create' | 'update' | 'delete';
  path: string;
  data?: any;
}

export function commitBatchWithContext(batch: WriteBatch, context: BatchContext): Promise<void> {
  return batch.commit().catch(error => {
    // Create the rich, contextual error.
    const permissionError = new FirestorePermissionError({
      operation: context.operation,
      path: context.path,
      requestResourceData: context.data,
    });
    
    // Emit the error with the global error emitter.
    errorEmitter.emit('permission-error', permissionError);

    // Also re-throw the error to stop the execution flow of the calling function.
    // This prevents the UI from getting into an inconsistent state.
    throw permissionError;
  });
}
