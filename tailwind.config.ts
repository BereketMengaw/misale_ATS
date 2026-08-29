import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Amharic needs a font with Ethiopic coverage; system stacks fall back badly.
        sans: ['var(--font-sans)', 'Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
