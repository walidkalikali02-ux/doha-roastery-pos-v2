import { useCallback } from 'react';
import { toast, useToast, ToastContainer } from '../components/common/Toast';

interface ErrorToastReturn {
  showError: (message: string, duration?: number) => string;
  showSuccess: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
  toasts: ReturnType<typeof useToast>['toasts'];
  dismiss: ReturnType<typeof useToast>['dismiss'];
  ToastContainer: typeof ToastContainer;
}

function useErrorToast(): ErrorToastReturn {
  const { toasts, dismiss } = useToast();

  const showError = useCallback((message: string, duration?: number) => {
    return toast.error(message, duration);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return toast.success(message, duration);
  }, []);

  const showWarning = useCallback((message: string, duration?: number) => {
    return toast.warning(message, duration);
  }, []);

  const showInfo = useCallback((message: string, duration?: number) => {
    return toast.info(message, duration);
  }, []);

  return { showError, showSuccess, showWarning, showInfo, toasts, dismiss, ToastContainer };
}

export { useErrorToast };
export type { ErrorToastReturn };
