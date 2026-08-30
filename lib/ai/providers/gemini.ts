import { env } from '@/lib/env'
import type {
  AiProvider, Answer, CvFile, CvRead, DocumentRead, JobFields, PostDraft, Question, RawCv, RawDocument,
} from '../types'
import { writePostTemplate, parseCvTemplate, verifyDocumentTemplate } from './template'
import { DEFAULT_AREAS, SUBJECT_CHOICES } from '@/lib/candidates/options'

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

// Reading a whole document is not answering a sentence: a scanned two-page CV
// takes the best part of ten seconds. Nobody is waiting on a Telegram webhook
// for it — the operator pressed a button and can watch it spin — so the budget
// is the page's `maxDuration`, less a margin to write the result.
const CV_TIMEOUT_MS = 25_000

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

// ---------------------------------------------------------------------------
// Reading a CV
// ---------------------------------------------------------------------------

/**
 * The reader's whole licence. Everything it is told to return is checked again
 * in `lib/candidates/cv.ts`, which drops any value that is not a real enum, a
 * known subject or a real Ethiopian number — so the worst a bad reading can do
 * is say nothing.
 *
 * The one rule that cannot be checked afterwards is the first one. Nothing here
 * knows what a CV should contain, so an invented subject is indistinguishable
 * from a read one; it has to not be written in the first place.
 */
function cvSystem(today: string): string {
  return [
    "You are reading a tutor's CV for a tutoring agency in Addis Ababa.",
    '',
    'Fill in every field from what the document says. Read it properly: a',
    'qualification, an address and a run of dates are things the CV states, and',
    'working them out from the words on the page is the job, not inference.',
    '',
    'What is forbidden is inventing. Never supply a subject, a school, a place or',
    'a number that is not there to be read. A field the document genuinely does',
    'not answer is null, and null is the right answer far more often than a',
    'plausible guess is.',
    '',
    `Today is ${today}. Use it to count anything written as running to "present".`,
    '',
    'Fields:',
    '- fullName: the name of the person whose CV this is. Null if the document is not a CV.',
    '- phone: their mobile number, exactly as written.',
    "- education: the highest qualification stated, in the CV's own words (\"BSc in Applied Mathematics\", \"MSc student\", \"Diploma in Accounting\").",
    '- institution: the school or university that awarded it.',
    '- area: the sub-city or neighbourhood of their address in Addis Ababa. Null if the address is elsewhere or absent.',
    '- experienceYears: total years of teaching or tutoring, as a number. Count only teaching, and count from the dates of the teaching roles listed. Null only if no teaching job carries a date.',
    '- subjects: the subjects they teach. Use these words where they fit: ' + SUBJECT_CHOICES.join(', ') + '.',
    "- grades: the grade levels they teach, as the CV writes them (\"grades 9-12\", \"grade 7\", \"high school\", \"university\").",
    '',
    'Known sub-cities: ' + DEFAULT_AREAS.join(', ') + '.',
  ].join('\n')
}

export const CV_SCHEMA = {
  type: 'OBJECT',
  properties: {
    fullName: { type: 'STRING', nullable: true },
    phone: { type: 'STRING', nullable: true },
    education: { type: 'STRING', nullable: true },
    institution: { type: 'STRING', nullable: true },
    area: { type: 'STRING', nullable: true },
    experienceYears: { type: 'NUMBER', nullable: true },
    subjects: { type: 'ARRAY', items: { type: 'STRING' } },
    grades: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  // Every field, or the model answers only the easy ones. Left optional, a
  // flash-lite model returned the name and the phone number off the top of the
  // page and omitted the degree, the address and the dates — and an omitted
  // field is indistinguishable from one the CV does not contain.
  required: [
    'fullName',
    'phone',
    'education',
    'institution',
    'area',
    'experienceYears',
    'subjects',
    'grades',
  ],
} as const

/**
 * Gemini reads PDFs and photographs of CVs directly. Sending the bytes is the
 * whole reason there is no OCR step in this codebase — see the AI row of
 * `docs/06-decisions.md`.
 */
async function readCv(file: CvFile, apiKey: string): Promise<RawCv | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CV_TIMEOUT_MS)

  try {
    const res = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: cvSystem(new Date().toISOString().slice(0, 10)) }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: file.mime, data: Buffer.from(file.bytes).toString('base64') } },
              { text: 'Read this CV.' },
            ],
          },
        ],
        generationConfig: {
          // Zero, not the answerer's 0.2. There is nothing to phrase well here;
          // the same CV read twice should give the same profile.
          temperature: 0,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
          responseSchema: CV_SCHEMA,
        },
      }),
    })

    if (!res.ok) {
      console.error(`gemini cv ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return null
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const parsed = JSON.parse(text) as RawCv
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (err) {
    console.error('gemini cv read failed', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Checking an educational document
// ---------------------------------------------------------------------------

/**
 * Note what is not asked for. The model is never invited to judge whether a
 * certificate is genuine, and never asked whether the tutor is telling the
 * truth. It reads the paper and reports it; whether that backs what they
 * answered is decided in `lib/candidates/documents.ts`, by comparing two enums.
 *
 * That split is the whole safety of this feature. A model asked "is this real?"
 * will answer, confidently, on no evidence — and the answer would be about a
 * person's honesty, sitting in a database, next to their name.
 */
const DOC_SYSTEM = [
  'You are reading a scanned educational document from Ethiopia — a degree certificate,',
  'a diploma, a university transcript, or a grade 12 national exam certificate.',
  '',
  'Report only what is printed on it. Do not judge whether it is authentic, and do not',
  'comment on the person. If the image is too poor to read a field, that field is null.',
  '',
  'Fields:',
  '- kind: one of degree, diploma, transcript, grade12, other, not-a-document.',
  '  Use not-a-document only when the file is plainly not educational at all — a photo of a',
  '  person, a receipt, a blank page. A document you cannot read is "other", not "not-a-document".',
  "- level: the qualification exactly as printed (\"Bachelor of Science in Physics\", \"Diploma in Accounting\").",
  '  Null for a transcript or a grade 12 certificate, which award no qualification.',
  '- holderName: the name of the person the document is about, as printed.',
  '- institution: the university, college or school that issued it.',
  '- awardedYear: the four-digit year it was issued. If the date is in the Ethiopian calendar,',
  '  convert it to the Gregorian year. Null if no year is printed.',
].join('\n')

export const DOC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: {
      type: 'STRING',
      enum: ['degree', 'diploma', 'transcript', 'grade12', 'other', 'not-a-document'],
    },
    level: { type: 'STRING', nullable: true },
    holderName: { type: 'STRING', nullable: true },
    institution: { type: 'STRING', nullable: true },
    awardedYear: { type: 'STRING', nullable: true },
  },
  // Same lesson as CV_SCHEMA: left optional, the fields that take actual
  // reading are the ones that quietly go missing.
  required: ['kind', 'level', 'holderName', 'institution', 'awardedYear'],
} as const

async function readDocument(file: CvFile, apiKey: string): Promise<RawDocument | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CV_TIMEOUT_MS)

  try {
    const res = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: DOC_SYSTEM }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: file.mime, data: Buffer.from(file.bytes).toString('base64') } },
              { text: 'Read this document.' },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
          responseSchema: DOC_SCHEMA,
        },
      }),
    })

    if (!res.ok) {
      console.error(`gemini document ${res.status}: ${(await res.text()).slice(0, 300)}`)
      return null
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const parsed = JSON.parse(text) as RawDocument
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (err) {
    console.error('gemini document read failed', err)
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

  /**
   * Never throws for a reason the caller must handle: an unreadable CV comes
   * back as the template's "nothing was read", which is the same state as
   * having no model at all and needs no different handling.
   */
  async parseCv(file: CvFile): Promise<CvRead> {
    const apiKey = env.geminiApiKey
    if (!apiKey) return parseCvTemplate()

    const raw = await readCv(file, apiKey)
    if (!raw) return parseCvTemplate()

    return { read: true, raw, generatedBy: 'gemini' }
  },

  async verifyDocument(file: CvFile): Promise<DocumentRead> {
    const apiKey = env.geminiApiKey
    if (!apiKey) return verifyDocumentTemplate()

    const raw = await readDocument(file, apiKey)
    if (!raw) return verifyDocumentTemplate()

    return { read: true, raw, generatedBy: 'gemini' }
  },
}
