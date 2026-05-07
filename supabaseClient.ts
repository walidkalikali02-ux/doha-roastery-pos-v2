import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL) ?? '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? '';

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const missingVars = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
]
  .filter(Boolean)
  .join(', ');
const missingEnvMessage = `Supabase configuration is missing: ${missingVars}`;

const createErrorResponse = (message: string) => ({
  data: null,
  error: { message },
});

const createNoopQuery = (message: string): unknown => {
  const response = Promise.resolve(createErrorResponse(message));

  return new Proxy(
    {},
    {
      get(_target: object, prop: string | symbol) {
        if (prop === 'then') return response.then.bind(response);
        if (prop === 'catch') return response.catch.bind(response);
        if (prop === 'finally') return response.finally.bind(response);
        if (prop === 'single' || prop === 'maybeSingle') return () => response;
        if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'upsert') {
          return () => createNoopQuery(message);
        }
        if (
          prop === 'eq' ||
          prop === 'neq' ||
          prop === 'gt' ||
          prop === 'gte' ||
          prop === 'lt' ||
          prop === 'lte' ||
          prop === 'ilike' ||
          prop === 'like' ||
          prop === 'in' ||
          prop === 'contains' ||
          prop === 'overlaps' ||
          prop === 'order' ||
          prop === 'range' ||
          prop === 'limit' ||
          prop === 'rangeFrom' ||
          prop === 'rangeTo' ||
          prop === 'match' ||
          prop === 'or' ||
          prop === 'not' ||
          prop === 'filter' ||
          prop === 'csv' ||
          prop === 'textSearch' ||
          prop === 'abortSignal'
        ) {
          return () => createNoopQuery(message);
        }
        if (prop === 'maybeSingle') return () => response;
        return undefined;
      },
    }
  );
};

const createNoopAuth = (message: string) => ({
  getSession: async () => createErrorResponse(message),
  getUser: async () => createErrorResponse(message),
  signInWithPassword: async () => createErrorResponse(message),
  signOut: async () => createErrorResponse(message),
  resetPasswordForEmail: async () => createErrorResponse(message),
  updateUser: async () => createErrorResponse(message),
  refreshSession: async () => createErrorResponse(message),
  onAuthStateChange: () => ({
    data: {
      subscription: {
        unsubscribe: () => undefined,
      },
    },
  }),
});

const createNoopStorage = (message: string) => ({
  from: () => ({
    upload: async () => createErrorResponse(message),
    download: async () => createErrorResponse(message),
    list: async () => createErrorResponse(message),
    remove: async () => createErrorResponse(message),
    createSignedUrl: async () => createErrorResponse(message),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  }),
});

const createNoopChannel = () => ({
  on: () => createNoopChannel(),
  subscribe: () => ({ unsubscribe: () => undefined }),
  send: async () => ({ error: null }),
  track: async () => ({ error: null }),
});

const createNoopSupabaseClient = (message: string): SupabaseClient =>
  ({
    auth: createNoopAuth(message),
    from: () => createNoopQuery(message),
    rpc: async () => createErrorResponse(message),
    storage: createNoopStorage(message),
    channel: () => createNoopChannel(),
    removeChannel: () => undefined,
  } as unknown as SupabaseClient);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createNoopSupabaseClient(missingEnvMessage);

export { isSupabaseConfigured, missingEnvMessage };
