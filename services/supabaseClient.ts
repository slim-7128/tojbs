/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANT: Remplacez ces valeurs par les vôtres depuis le tableau de bord Supabase
// Settings > API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.startsWith('http') 
  ? import.meta.env.VITE_SUPABASE_URL 
  : 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'tojbs_supabase_auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
