/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0c10',
          surface: '#0f1117',
          elevated: '#161b25',
          card: '#1a2030',
          hover: '#1e2535',
        },
        border: {
          DEFAULT: '#1e2d45',
          bright: '#2a3d5c',
        },
        accent: {
          DEFAULT: '#0d6efd',
          dim: '#0a58ca',
        },
        teal: {
          DEFAULT: '#00d4aa',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
