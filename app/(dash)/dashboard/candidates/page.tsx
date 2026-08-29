import { redirect } from 'next/navigation'

/** Candidates and parents share one section now. Old links still work. */
export default function CandidatesIndex() {
  redirect('/dashboard/people')
}
