import { redirect } from 'next/navigation'

/** Placements live inside the job they came from. Old links still work. */
export default function PlacementsIndex() {
  redirect('/dashboard/jobs?phase=filled')
}
