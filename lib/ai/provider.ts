import type { AiProvider, JobFields, PostDraft } from './types'
import { templateProvider, writePostTemplate } from './providers/template'

export type { AiProvider, JobFields, PostDraft }

/**
 * The ONLY place a model is called. Nothing else in the codebase imports a
 * model SDK — see CLAUDE.md.
 *
 * Default is the template provider, which uses no model at all. Real providers
 * (Gemini Flash free tier first) register here and must always degrade to the
 * template rather than fail: every AI step has to work without a model.
 */

const providers: Record<string, AiProvider> = {
  template: templateProvider,
  // gemini: geminiProvider,   ← added when the free tier is wired up
}

export function activeProviderName(): string {
  const name = process.env.AI_PROVIDER?.trim() || 'template'
  return name in providers ? name : 'template'
}

export function getProvider(): AiProvider {
  return providers[activeProviderName()]
}

/**
 * Write a job post. Never throws: a model that is down, rate-limited or
 * off its free tier falls back to the deterministic template, and the caller
 * gets a usable post either way.
 */
export async function writePost(fields: JobFields): Promise<PostDraft> {
  const provider = getProvider()
  if (provider.name === 'template') return writePostTemplate(fields)

  try {
    return await provider.writePost(fields)
  } catch (err) {
    console.error(`ai provider "${provider.name}" failed on writePost, using template`, err)
    return writePostTemplate(fields)
  }
}
