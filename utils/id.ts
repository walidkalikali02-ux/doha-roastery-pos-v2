import { v4 as uuidv4 } from 'uuid';

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to uuidv4.
    }
  }

  return uuidv4();
};
