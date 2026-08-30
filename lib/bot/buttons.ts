/**
 * Every button the bot actually renders, by the words printed on it.
 *
 * One list, because two things need it and neither may drift from what is on
 * screen: the callback test that says a button must lead somewhere, and
 * `rejectAnswer()`, which now says an answer may not name a button that is not
 * here. A model that invents "Register again" sends a tutor looking for a
 * button that was removed, and looking for it is all they can do — there is
 * nobody to ask.
 *
 * Derived, never hand-written. A renamed button renames itself here.
 */
import { copy } from './copy'
import { EDIT_LABEL } from './flows/steps'

export const BUTTON_LABELS: readonly string[] = [
  ...Object.values(copy.buttons),
  ...Object.values(EDIT_LABEL),
]

/**
 * The same labels, comparable: lowercased, and stripped of the decoration a
 * label may carry ('← Back', 'I agree — continue') so a sentence naming the
 * button in plain prose still matches it.
 */
export const COMPARABLE_LABELS: readonly string[] = BUTTON_LABELS
  .map((label) => label.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim())
  .filter((label) => label.length >= 3)
