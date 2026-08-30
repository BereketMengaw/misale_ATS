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
