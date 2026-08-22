import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY ontbreken. Kopieer .env.example naar .env.')
}

// De publieke sleutel mag in de bundel staan: sinds augustus 2026 laten de
// RLS-policies alleen een ingelogde gebruiker bij de gegevens. Zie de migratie
// 20260822000001_echte_login_en_rls.sql in de oude repo.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
