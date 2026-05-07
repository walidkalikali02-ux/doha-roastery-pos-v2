import { ReactNode, ComponentProps } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-8 min-h-[300px] bg-gray-50 dark:bg-gray-900 rounded-xl"
    >
      <AlertTriangle className="text-red-500 mb-4" size={48} />
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-md text-center">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={resetErrorBoundary}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          aria-label="Try again"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  onError?: ComponentProps<typeof ReactErrorBoundary>['onError'];
  onReset?: ComponentProps<typeof ReactErrorBoundary>['onReset'];
  resetKeys?: ComponentProps<typeof ReactErrorBoundary>['resetKeys'];
}

export function ErrorBoundary({
  children,
  onError,
  onReset,
  resetKeys,
}: ErrorBoundaryWrapperProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={onError}
      onReset={onReset}
      resetKeys={resetKeys}
    >
      {children}
    </ReactErrorBoundary>
  );
}
