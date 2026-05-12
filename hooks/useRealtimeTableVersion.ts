import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

type Options = {
  enabled?: boolean;
  schema?: string;
};

export function useRealtimeTableVersion(
  tables: string[],
  options: Options = {}
): number {
  const { enabled = true, schema = 'public' } = options;
  const [version, setVersion] = useState(0);
  const tablesKey = useMemo(() => [...new Set(tables)].sort().join('|'), [tables]);
  const normalizedTables = useMemo(() => tablesKey.split('|').filter(Boolean), [tablesKey]);

  useEffect(() => {
    if (!enabled || !tablesKey) return;

    const channel = supabase.channel(`realtime_${schema}_${tablesKey}`);
    normalizedTables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema, table },
        () => setVersion((current) => current + 1)
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, normalizedTables, schema, tablesKey]);

  return version;
}
