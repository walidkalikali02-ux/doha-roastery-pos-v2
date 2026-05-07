import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Z_INDEX } from '../../constants/zIndex';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const TOAST_CONFIG: Record<
  ToastType,
  {
    icon: typeof CheckCircle;
    bg: string;
    border: string;
    text: string;
    defaultDuration: number;
    ariaRole: 'status' | 'alert';
  }
> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-500',
    text: 'text-green-800 dark:text-green-200',
    defaultDuration: 4000,
    ariaRole: 'status',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
    defaultDuration: 6000,
    ariaRole: 'alert',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
    defaultDuration: 5000,
    ariaRole: 'alert',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
    defaultDuration: 4000,
    ariaRole: 'status',
  },
};

export { type Toast, type ToastType, TOAST_CONFIG };

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      style={{ zIndex: Z_INDEX.TOAST }}
      className="fixed bottom-4 right-4 flex flex-col gap-2 max-w-sm"
    >
      {toasts.map((toast) => {
        const config = TOAST_CONFIG[toast.type];
        const IconComponent = config.icon;
        return (
          <div
            key={toast.id}
            role={config.ariaRole}
            className={`${config.bg} border-2 ${config.border} ${config.text} px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in`}
          >
            <IconComponent className="shrink-0" size={20} />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 ml-2 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

let toastIdCounter = 0;
const toastListeners: Array<(toasts: Toast[]) => void> = [];
let activeToasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...activeToasts]));
}

function addToast(message: string, type: ToastType, duration?: number) {
  const id = `toast-${++toastIdCounter}`;
  const config = TOAST_CONFIG[type];
  const toast: Toast = { id, message, type, duration: duration ?? config.defaultDuration };
  activeToasts = [...activeToasts, toast];
  notifyListeners();

  setTimeout(() => {
    activeToasts = activeToasts.filter((t) => t.id !== id);
    notifyListeners();
  }, toast.duration);

  return id;
}

export const toast = {
  success: (message: string, duration?: number) => addToast(message, 'success', duration),
  error: (message: string, duration?: number) => addToast(message, 'error', duration),
  warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
  info: (message: string, duration?: number) => addToast(message, 'info', duration),
  dismiss: (id: string) => {
    activeToasts = activeToasts.filter((t) => t.id !== id);
    notifyListeners();
  },
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) toastListeners.splice(index, 1);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  return { toasts, dismiss };
}
