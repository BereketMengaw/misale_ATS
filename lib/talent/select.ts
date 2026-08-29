/**
 * Who gets a "this job suits you" DM. PURE — the whole decision is arithmetic
 * over data the caller supplies, so the spam rules are testable without a bot.
 *
 * Three rules, in order of how much damage breaking them does:
 *
 * 1. Never message someone who already applied for this job.
 * 2. Never message the same person twice about the same job.
 * 3. Never message anyone more often than the cooldown, however well they
 *    match. A tutor who gets a DM every day mutes the bot, and then they are
 *    gone for every future job as well.
 */

export type PoolCandidate = {
  candidateId: number
  score: number
  excluded: boolean
  /** Already applied for this job, by any route. */
  hasApplied: boolean
  /** Already sent a DM about this job. */
  alreadyMatched: boolean
  /** When we last DM'd them about anything, or null. */
  lastDmAt: string | null
  /** No chat id means the bot has never been able to message them. */
  reachable: boolean
}

export type MatchRules = {
  minScore: number
  maxPerJob: number
  cooldownDays: number
}

export const DEFAULT_RULES: MatchRules = {
  minScore: 60,
  maxPerJob: 10,
  cooldownDays: 3,
}

export type Skipped = { candidateId: number; reason: string }

export type Selection = {
  chosen: PoolCandidate[]
  skipped: Skipped[]
}

export function selectForDm(
  pool: PoolCandidate[],
  rules: MatchRules = DEFAULT_RULES,
  now: Date = new Date(),
): Selection {
  const chosen: PoolCandidate[] = []
  const skipped: Skipped[] = []
  const cooldownMs = rules.cooldownDays * 24 * 60 * 60 * 1000

  // Best match first, so the cap keeps the strongest rather than the earliest.
  const ordered = [...pool].sort((a, b) => b.score - a.score)

  for (const c of ordered) {
    if (c.hasApplied) { skipped.push({ candidateId: c.candidateId, reason: 'already applied' }); continue }
    if (c.alreadyMatched) { skipped.push({ candidateId: c.candidateId, reason: 'already messaged about this job' }); continue }
    if (c.excluded) { skipped.push({ candidateId: c.candidateId, reason: 'job asks for someone else' }); continue }
    if (!c.reachable) { skipped.push({ candidateId: c.candidateId, reason: 'bot cannot message them' }); continue }
    if (c.score < rules.minScore) { skipped.push({ candidateId: c.candidateId, reason: `scores ${c.score}, below ${rules.minScore}` }); continue }

    if (c.lastDmAt) {
      const since = now.getTime() - new Date(c.lastDmAt).getTime()
      if (since < cooldownMs) {
        const days = Math.ceil((cooldownMs - since) / (24 * 60 * 60 * 1000))
        skipped.push({ candidateId: c.candidateId, reason: `messaged recently, ${days}d to go` })
        continue
      }
    }

    if (chosen.length >= rules.maxPerJob) {
      skipped.push({ candidateId: c.candidateId, reason: 'over the per-job limit' })
      continue
    }

    chosen.push(c)
  }

  return { chosen, skipped }
}
