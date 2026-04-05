import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface UseRoleGuardReturn {
  isAllowed: boolean;
  toastMessage: string | null;
  denyAccess: (message: string) => void;
  dismissToast: () => void;
}

const TOAST_DURATION_MS = 4000;

export function useRoleGuard(allowedRoles: UserRole[]): UseRoleGuardReturn {
  const { user } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAllowed = useMemo(
    () => (user ? allowedRoles.includes(user.role) : false),
    [user?.role, allowedRoles]
  );

  const denyAccess = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return { isAllowed, toastMessage, denyAccess, dismissToast };
}