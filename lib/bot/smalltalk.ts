/**
 * The things people type that are not questions, not commands, and not an
 * answer to a step.
 *
 * The bot had one bucket for all of them — `isCourtesy` in answers/intent.ts —
 * and one sentence to reply with. That is how "Hello" was answered with "Any
 * time.", how "sorry, I was busy" and "thank you" got the identical line, and
 * how "I'm a maths teacher with three years behind me" was met with a menu.
 * None of that is wrong, exactly. It is just not how a person replies, and it
 * is most of why the bot reads like a machine even when every fact it sends is
 * correct.
 *
 * The intent layer stays exactly as it is: `lib/mining/questions.ts` counts its
 * buckets and they must not drift. This sits beside it and decides only what to
 * SAY. Finer categories, no new routing, no new intents.
 *
 * Nothing here is a way to reach a person, and nothing here queues, forwards or
 * escalates. `frustrated` is the one that has to be careful about it: somebody
 * who is annoyed is exactly who a bot is most tempted to hand off, and the
 * honest reply is that there is nobody to hand them to.
 *
 * Pure. Text in, kind out — no I/O and no model.
 */
import { normalize } from './answers/retrieve'

export type SmallTalk =
  | 'how-are-you'
  | 'frustrated'
  | 'praise'
  | 'apology'
  | 'later'
  | 'introduces-themselves'
  | 'farewell'
  | 'greeting'
  | 'thanks'
  | 'affirm'

/**
 * Words that carry no topic of their own. They are allowed inside a courtesy
 * without changing what it is: "ok thank you so much brother" is still thanks.
 */
const FILLER = new Set([
  'a', 'again', 'all', 'alot', 'am', 'and', 'any', 'are', 'as', 'at', 'be',
  'boss', 'bro', 'brother', 'dear', 'do', 'everyone', 'for', 'friend', 'i',
  'is', 'it', 'lot', 'madam', 'man', 'me', 'much', 'my', 'no', 'of', 'oh',
  'please', 'really', 'sir', 'sister', 'so', 'that', 'the', 'then', 'there',
  'this', 'to', 'too', 'u', 'very', 'was', 'well', 'you', 'your',
  // Acknowledgements stack in front of everything else — "ok thank you",
  // "yes hello". They only name a kind of their own when nothing else does,
  // which AFFIRM_CORE below handles.
  'ok', 'okay', 'oky', 'okey', 'yes', 'yeah', 'ya', 'sure', 'alright', 'fine',
  // normalize() turns an apostrophe into a space, so "I'm" arrives as "i m".
  's', 'm', 't', 're', 'll', 've',
])

const GREETING_CORE = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hallo', 'hey', 'heyy', 'hy', 'yo',
  'greetings', 'morning', 'afternoon', 'evening',
  // Amharic greetings as people actually type them in Latin script
  'selam', 'salam', 'tena', 'yistilign', 'endemen', 'endet',
])
const GREETING_ALSO = new Set(['good', 'day', 'nesh', 'neh', 'nachu', 'welcome'])

const FAREWELL_CORE = new Set(['bye', 'byebye', 'goodbye', 'farewell', 'ciao', 'gn', 'adios', 'chao'])
const FAREWELL_ALSO = new Set(['good', 'night', 'take', 'care', 'see', 'later', 'have', 'nice'])

const THANKS_CORE = new Set([
  'thanks', 'thank', 'thankyou', 'thx', 'tnx', 'tx', 'appreciate', 'appreciated',
  'grateful', 'ameseginalehu', 'ameseginalew', 'bless', 'blessed',
])
const THANKS_ALSO = new Set(['god', 'may', 'always', 'problem', 'welcome', 'lots', 'many'])

const AFFIRM_CORE = new Set([
  'ok', 'okay', 'oky', 'okey', 'k', 'kk', 'yes', 'yeah', 'ya', 'yep', 'yup',
  'sure', 'alright', 'fine', 'noted', 'understood', 'got', 'exactly',
  'true', 'right', 'agreed', 'eshi', 'ayzoh', 'np', 'cool', 'perfect',
  // 'correct' is deliberately absent: "correct" is a keyword on
  // profile-change, and "correct my details" is a request, not a nod.
])
const AFFIRM_ALSO = new Set(['nice', 'good', 'great', 'will', 'problem', 'course', 'now', 'later', 'sounds'])

/**
 * Every word of the message is one the kind allows, and at least one of them
 * is a word that actually names the kind. Both halves matter: without the core
 * word "good sir" is a greeting, and without the whole-message rule "thanks,
 * but which of these jobs pays more" is one too.
 */
function isEntirely(text: string, core: Set<string>, also: Set<string>, maxWords = 8): boolean {
  const words = normalize(text).split(' ').filter(Boolean)
  if (words.length === 0 || words.length > maxWords) return false
  if (!words.some((w) => core.has(w))) return false
  return words.every((w) => core.has(w) || also.has(w) || FILLER.has(w))
}

/**
 * What is left once the phrase that matched is taken out.
 *
 * "Sorry" is an apology. "Sorry, I meant which grade would I be teaching and
 * where" is a question with an apology stuck on the front, and answering it
 * with "no need to apologise" is the machine at its worst. So a phrase only
 * claims the message when almost nothing else is in it.
 */
function remainderIsThin(text: string, pattern: RegExp): boolean {
  const rest = text.replace(pattern, ' ')
  const words = normalize(rest).split(' ').filter((w) => w && !FILLER.has(w))
  return words.length <= 2
}

/** Asked after the bot's health, which no knowledge entry will ever cover. */
const HOW_ARE_YOU =
  /\bhow (?:are|r) (?:you|u|ya)\b|\bhow(?:'?s| is|s) it going\b|\bhow (?:have you been|are things|you doing|do you do)\b|\bare you (?:ok|okay|good|fine|well|alright)\b|\bwhat(?:'?s| is|s) up\b|\bwassup\b|\bhope you(?:'?re| are)? (?:well|good|fine)\b/i

/**
 * Somebody who has had enough. Worth catching before anything else, because
 * half of these are shaped like questions and would otherwise be sent to the
 * knowledge base, which is what annoyed them in the first place.
 */
const FRUSTRATED =
  /\byou (?:don'?t|do not|dont|didn'?t|never) (?:understand|get it|get me|listen|answer|help)\b|\bthat(?:'?s| is|s) not what i (?:asked|said|meant|want)\b|\bi (?:already )?(?:said|told you|asked)\b|\b(?:this|it|that|you) (?:is|are)(?: so| very| really| just)? (?:useless|stupid|pointless|annoying|frustrating|unhelpful|nonsense|rubbish|a waste)\b|\bnot (?:helpful|helping|answering|working)\b|\bstop (?:sending|repeating|saying)\b|\bsame (?:message|answer|thing|reply)\b|\byou keep (?:sending|saying|repeating|giving)\b|\bwhat(?:'?s| is|s) wrong with (?:you|this|it)\b|\bi(?:'?m| am) (?:so |very |really )?(?:confused|lost|tired of|fed up)\b/i

const PRAISE =
  /\b(?:good|great|nice|excellent|amazing|wonderful|awesome|impressive|brilliant) (?:job|work|bot|system|service|idea|one)\b|\bwell done\b|\b(?:this|it|that) (?:is|looks|sounds|was)(?: really| very| so)? (?:great|good|nice|helpful|useful|amazing|cool|smart|clear|impressive|wonderful)\b|\bi (?:like|love|really like) (?:this|it|the bot|your)\b|\byou(?:'?re| are|r) (?:so |very |really )?(?:good|great|smart|helpful|fast|clever|amazing)\b|\bkeep (?:it up|up the good work)\b|\bmashallah\b|\bwow\b/i

const APOLOGY =
  /\b(?:so |very |really |terribly |extremely )?sorry\b|\bmy apolog\w*|\bapolog(?:y|ies|ise[ds]?|ize[ds]?|ising|izing)\b|\bforgive me\b|\bmy (?:bad|fault|mistake)\b|\bpardon me\b/i

/**
 * A bare "next week" is deliberately NOT here. It reads as a delay and is
 * just as often availability: "I can start next week" is a tutor telling us
 * when they are free, and answering that with "no rush, take your time" is
 * the opposite of what they said. A delay has to say so — "maybe next week",
 * "I'll get back to you next week" — both of which still match above.
 */
const LATER =
  /\bi(?:'?ll| will| shall| am going to|'?m going to)? ?(?:get back|come back|write back|reply|answer you|let you know|update you|decide|think about it|think it over|think about this)\b|\bnot (?:now|today|right now|at the moment|yet)\b|\bi(?:'?m| am) (?:busy|at work|in class|in a meeting|travel\w*|out of town|not free|on the road)\b|\blet me (?:think|check|see|ask|confirm|talk to)\b|\bmaybe (?:later|next week|tomorrow|another time)\b|\bgive me (?:some |a little )?time\b|\bi(?:'?ll| will) (?:be back|come back|check later)\b|\bafter (?:my |the )?(?:exam|exams|semester|holiday)\w*\b/i

/**
 * Somebody typing their qualifications into the chat. Common, and until now
 * the worst reply in the bot: a person who has just told you they have taught
 * physics for four years gets a menu. It counts — but only once it is on the
 * profile, because that is the thing the ranker reads, and saying so is more
 * use than a menu.
 */
const INTRODUCES_THEMSELVES =
  /\bi(?:'?m| am) an? (?:[a-z]+ ){0,2}(?:teacher|tutor|student|graduate|engineer|instructor|lecturer|professional)\b|\bi (?:have|had|got|hold) (?:over |about |around |more than |almost )?\d+\+? ?(?:years?|yrs?|months?)\b|\bi (?:teach|taught|tutor|tutored|studied|study|graduated|majored|specialis\w+|specializ\w+|lecture[d]?)\b|\bmy (?:degree|major|background|experience|field|speciality|specialty|profession) (?:is|was|in)\b|\bi (?:hold|have) an? (?:bsc|b sc|ba|ma|msc|m sc|phd|degree|diploma|masters?|bachelor\w*)\b|\bi(?:'?ve| have) been (?:teaching|tutoring)\b/i

/**
 * Anything shaped like a question goes to the answerer, whatever else it looks
 * like. The kinds checked above this line are the exceptions: they are shaped
 * like questions too, and no knowledge entry will ever cover them.
 */
/** Said as a phrase rather than a word: "see you later", "good night". */
const FAREWELL_PHRASES =
  /\b(?:see (?:you|ya)|take care|good ?night|talk (?:to you )?later|till next time|until next time|have a (?:good|nice|lovely) (?:day|night|evening|weekend))\b/i

const OPENS_A_QUESTION =
  /^(?:are|is|was|were|do|does|did|can|could|will|would|should|have|has|how|what|why|when|where|which|who|may|might)\b/i

export function readSmallTalk(text: string): SmallTalk | null {
  const t = text.trim()
  if (!t) return null

  if (FRUSTRATED.test(t)) return 'frustrated'
  if (HOW_ARE_YOU.test(t) && remainderIsThin(t, HOW_ARE_YOU)) return 'how-are-you'

  if (t.endsWith('?') || OPENS_A_QUESTION.test(t)) return null

  if (PRAISE.test(t) && remainderIsThin(t, PRAISE)) return 'praise'
  if (INTRODUCES_THEMSELVES.test(t)) return 'introduces-themselves'
  if (APOLOGY.test(t) && remainderIsThin(t, APOLOGY)) return 'apology'
  if (LATER.test(t) && remainderIsThin(t, LATER)) return 'later'

  if (FAREWELL_PHRASES.test(t) && remainderIsThin(t, FAREWELL_PHRASES)) return 'farewell'

  if (isEntirely(t, GREETING_CORE, GREETING_ALSO)) return 'greeting'
  if (isEntirely(t, FAREWELL_CORE, FAREWELL_ALSO)) return 'farewell'
  if (isEntirely(t, THANKS_CORE, THANKS_ALSO)) return 'thanks'
  if (isEntirely(t, AFFIRM_CORE, AFFIRM_ALSO)) return 'affirm'

  return null
}
