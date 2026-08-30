import { env } from '@/lib/env'
import type { AiProvider, Answer, JobFields, PostDraft, Question } from '../types'
import { writePostTemplate } from './template'

/**
 * Gemini Flash, free tier. The only place in the codebase that talks to a
 * model over the wire — see CLAUDE.md.
 *
 * Plain fetch rather than an SDK: one request shape, no dependency, and the
 * whole call is visible here. It must never throw for a reason the caller has
 * to handle; `provider.ts` still catches, but a timeout here is what stops a
 * slow model from holding a Telegram webhook open until it is retried.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
// Measured at 2.5-3.5s against the flash-lite models. Six seconds leaves room
// for a slow one without spending the whole serverless budget on it: a call
// that overruns falls back to the matched fact, which is a real answer.
const TIMEOUT_MS = 6_000

function model(): string {
  return env.geminiModel
}

/**
 * The whole of the bot's licence to speak. Every restriction here has a
 * matching runtime check in provider.ts, because a prompt is a request and a
 * check is a guarantee.
 */
const SYSTEM = [
  'You are the Misale tutors bot, replying to a tutor on Telegram in Ethiopia.',
  '',
  'You will be given FACTS. They are the only things you know.',
  '',
  'Rules:',
  '- Answer using the FACTS only. Never state a number, date, fee, name or policy that is not in them.',
  '- If the FACTS do not answer the question, set covered to false and leave answer empty. Do not guess, and do not partly answer.',
  '- Never say a person will call, reply, contact or get back to them. Nobody reads this chat.',
  '- Never offer to negotiate, make an exception, or pass a message on.',
  '- Write in plain English. No Amharic, no markdown, no emoji, no links.',
  '- At most 60 words. Warm and direct, like a colleague answering quickly.',
  '- Answer the question that was actually asked; do not recite every fact you were given.',
  '- You may be given more facts than the question needs. Use the ones that apply and ignore the rest.',
  '- List in usedFactIds the id of every fact your answer relies on. If that list would be empty, the FACTS did not answer the question: set covered to false.',
  '- A fact that is merely about a similar word does not count. "What if I want to stop teaching" is not answered by a fact about deleting your data.',
  '- CONVERSATION is what has already been said here. Resolve "it", "that", "are you sure", "what about this" against it, and do not repeat an answer you have already given in the same words.',
  '- "I mean...", "no, I meant", "after I started" and the like correct the question before them. Answer the corrected question, and do not repeat the answer they just told you was wrong.',
  '- ABOUT THEM says where this person stands right now. Answer their situation, not the general case.',
  '- Never address them as though they were further along than they are. Somebody who has not applied is not teaching: answer them about what would happen ("if you take a job and later need to stop"), not about what they are doing.',
  '- Never address them as though they were further back either. Somebody already hired does not need to be told how to apply, or that they will hear if they are shortlisted.',
  '- covered is about the FACTS only. Never set it false because their situation makes the question an odd one to ask — if the facts answer it, answer, and say how it applies to them.',
  '- Neither CONVERSATION nor ABOUT THEM is a fact. Never quote them as one, and never state a status they do not contain.',
].join('\n')

function prompt(question: Question): string {
  const facts = question.facts
    .map((f) => `FACT id=${f.id} (${f.topic})\n${f.answer}`)
    .join('\n\n')

  const about = question.standing
    ? ['ABOUT THEM', '----------', question.standing, '']
    : []

  const earlier = question.history?.length
    ? [
        'CONVERSATION SO FAR',
        '-------------------',
        ...question.history.flatMap((t) => [`They asked: ${t.question}`, `You answered: ${t.answer}`]),
        '',
      ]
    : []

  return [
    'FACTS',
    '-----',
    facts || '(none)',
    '',
    ...about,
    ...earlier,
    'QUESTION',
    '--------',
    question.text,
  ].join('\n')
}

type GeminiReply = { covered: boolean; answer: string; usedFactIds?: string[] }

async function generate(question: Question, apiKey: string): Promise<GeminiReply | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt(question) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              covered: { type: 'BOOLEAN' },
              answer: { type: 'STRING' },
              usedFactIds: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['covered', 'answer', 'usedFactIds'],
          },
        },
      }),
    })

    if (!res.ok) {
      // 429 is the free tier doing its job. Everything else is logged the same
      // way, because the caller's response to all of them is identical.
      console.error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return null
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const parsed = JSON.parse(text) as GeminiReply
    if (typeof parsed?.covered !== 'boolean' || typeof parsed?.answer !== 'string') return null
    return parsed
  } catch (err) {
    console.error('gemini call failed', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const geminiProvider: AiProvider = {
  name: 'gemini',

  /**
   * Step 2's job, not this one. Posts stay on the template until someone
   * decides a model writes them better than the template does.
   */
  async writePost(fields: JobFields): Promise<PostDraft> {
    return writePostTemplate(fields)
  },

  async answerQuestion(question: Question): Promise<Answer> {
    const apiKey = env.geminiApiKey
    if (!apiKey || question.facts.length === 0) {
      throw new Error('gemini unavailable')
    }

    const reply = await generate(question, apiKey)
    if (!reply) throw new Error('gemini produced nothing usable')

    return {
      text: reply.answer.trim(),
      covered: reply.covered && reply.answer.trim().length > 0,
      usedFactIds: Array.isArray(reply.usedFactIds) ? reply.usedFactIds : [],
      generatedBy: 'gemini',
    }
  },
}
