import { createClient } from '@supabase/supabase-js';

// ⚠️ IMPORTANT: Remplacez ces valeurs par les vôtres depuis le tableau de bord Supabase
// Settings > API
const SUPABASE_URL = process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('http') 
  ? process.env.SUPABASE_URL 
  : 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
