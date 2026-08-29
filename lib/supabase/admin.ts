import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Service-role client. Bypasses RLS — server-side only, and only for work the
 * bot and cron jobs do on nobody's behalf.
 */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
