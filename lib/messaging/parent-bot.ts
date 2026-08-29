/**
 * What a parent sees on Telegram. Amharic — see CLAUDE.md.
 * Length is free here, unlike SMS, so these can say a little more.
 */

export const parentBotCopy = {
  connected: (name: string) =>
    [
      `እንኳን ደህና መጡ${name ? `፣ ${name}` : ''}።`,
      '',
      'ከዚህ በኋላ የክፍያ መጠየቂያ፣ ደረሰኝ እና ስለ አስተማሪው መረጃ በዚህ በኩል ይደርስዎታል።',
      'መልስ መስጠት አያስፈልግም።',
    ].join('\n'),

  alreadyConnected: 'ቀድሞውኑ ተገናኝተዋል። መልእክቶች በዚህ በኩል ይደርስዎታል።',

  notFound: 'ይህ አገናኝ አልሰራም። እባክዎ ያገኙትን አገናኝ እንደገና ይጠቀሙ።',

  /** Anything a parent types. Nobody reads it, so say so kindly. */
  nothingToReply: 'ይህ መልእክት በራስ-ሰር የሚላክ ነው። መልስ አይነበብም።',
} as const
