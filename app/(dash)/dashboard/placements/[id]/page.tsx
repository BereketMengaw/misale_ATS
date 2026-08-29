import { notFound, redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** A placement is a section of its job now, not a page. Old links still work. */
export default async function PlacementRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data } = await supabaseAdmin()
    .from('placements')
    .select('job_post_id')
    .eq('id', Number(id))
    .maybeSingle()

  if (!data) notFound()
  redirect(`/dashboard/jobs/${data.job_post_id}#placement`)
}
