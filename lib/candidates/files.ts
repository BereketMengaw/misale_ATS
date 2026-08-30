/**
 * What the bot will accept as a file, in one place.
 *
 * The wizard and the "sent it afterwards" path both need these, and they must
 * agree: a transcript that was fine during registration cannot be refused an
 * hour later.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_MIME =
  /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats|image\/(jpeg|png|webp))/

/**
 * The subset a model can actually read, for step 5.
 *
 * Narrower than what is accepted, and it has to stay that way round: a Word
 * document is a perfectly good CV for a human to open and there is no reason to
 * refuse one at upload, but no model here reads .doc or .docx, so parsing
 * declines it by name rather than sending bytes that come back as nothing.
 */
export const READABLE_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/
