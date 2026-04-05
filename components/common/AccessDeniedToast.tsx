import { AlertTriangle, X } from 'lucide-react';
import { Z_INDEX } from '../../constants/zIndex';

interface AccessDeniedToastProps {
  message: string;
  onDismiss: () => void;
}

export function AccessDeniedToast({ message, onDismiss }: AccessDeniedToastProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ zIndex: Z_INDEX.TOAST }}
      className="fixed bottom-4 right-4 bg-orange-50 border-2 border-orange-600
                 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm
                 animate-fade-in"
    >
      <AlertTriangle className="text-orange-600 shrink-0" size={20} />
      <span className="text-orange-900 text-sm font-medium">{message}</span>
      <button
        onClick={onDismiss}
        className="text-orange-400 hover:text-orange-600 shrink-0 ml-2"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}