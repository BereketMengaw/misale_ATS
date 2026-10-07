import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only the routes that read the session. Public pages skip the
  // Supabase round-trip entirely.
  matcher: ['/dashboard/:path*', '/login'],
}
