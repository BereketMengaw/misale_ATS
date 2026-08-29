import { redirect } from 'next/navigation'

/** Channels are setup, so they live under Settings now. Old links still work. */
export default function ChannelsIndex() {
  redirect('/dashboard/settings')
}
