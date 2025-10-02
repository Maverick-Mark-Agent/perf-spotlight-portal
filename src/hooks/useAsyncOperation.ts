import { useState, useCallback } from 'react';
import { useErrorHandler } from './useErrorHandler';

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface AsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

export const useAsyncOperation = <T = any>(
  options: AsyncOperationOptions = {}
) => {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { handleError } = useErrorHandler();

  const execute = useCallback(async (
    operation: () => Promise<T>,
    operationOptions: AsyncOperationOptions = {}
  ) => {
    const { onSuccess, onError, showToast = true } = { ...options, ...operationOptions };

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await operation();
      setState({ data: result, loading: false, error: null });
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      const errorMessage = handleError(error, { showToast });
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw error;
    }
  }, [handleError, options]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
};
