/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: '#27272a',
        background: '#09090b',
        card: '#111113',
        muted: '#18181b',
        'muted-foreground': '#a1a1aa',
        income: '#22c55e',
        expense: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
