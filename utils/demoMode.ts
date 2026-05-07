const DEMO_USER_UUID = '00000000-0000-0000-0000-000000000000';

function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

function getDemoUserId(): string | null {
  if (!isDemoMode()) return null;
  return DEMO_USER_UUID;
}

export { isDemoMode, getDemoUserId, DEMO_USER_UUID };