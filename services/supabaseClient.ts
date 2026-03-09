/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANT: Remplacez ces valeurs par les vôtres depuis le tableau de bord Supabase
// Settings > API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http') 
  ? import.meta.env.VITE_SUPABASE_URL 
  : 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY || 'placeholder-anon-key';

// In-memory lock to avoid LockManager API issues in iframes
const locks: Record<string, Promise<any>> = {};
const memoryLock = async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  let prevLock = locks[name] || Promise.resolve();
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks[name] = prevLock.then(() => nextLock);

  await prevLock;
  try {
    return await fn();
  } finally {
    release!();
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'tojbs_supabase_auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: memoryLock
  }
});
