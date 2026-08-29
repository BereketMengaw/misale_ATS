import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Secret-key client. Bypasses row-level security — server-side only, and only
 * for work the bot and cron jobs do on nobody's behalf.
 */
export function supabaseAdmin() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
