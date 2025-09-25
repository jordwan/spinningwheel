import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a singleton Supabase client for use in the browser
let supabase: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient(): ReturnType<typeof createClient<Database>> | null {
  // Return null if credentials aren't configured
  if (!supabaseUrl || !supabaseAnonKey ||
      supabaseUrl === 'your_supabase_project_url' ||
      supabaseAnonKey === 'your_supabase_anon_key') {
    console.warn('Supabase credentials not configured. Session storage disabled.');
    return null;
  }

  // Create client if it doesn't exist
  if (!supabase) {
    try {
      supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false, // We're not using auth, just anonymous access
          autoRefreshToken: false,
        },
      });
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      return null;
    }
  }

  return supabase;
}

// Helper to check if Supabase is available
export function isSupabaseEnabled(): boolean {
  return getSupabaseClient() !== null;
}