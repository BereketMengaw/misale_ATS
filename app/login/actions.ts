'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

export async function signIn(_prev: { error?: string }, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/dashboard')

  if (!email || !password) return { error: 'Email and password are required.' }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(next.startsWith('/') ? next : '/dashboard')
}

export async function signOut() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
