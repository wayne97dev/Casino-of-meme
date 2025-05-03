/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      margin: {
        '20': '5rem', // Forza mt-20
      },
      padding: {
        '0.5': '0.125rem', // Forza py-0.5 e px-0.5
        '1': '0.25rem', // Forza px-1
      },
      fontSize: {
        '[10px]': '10px', // Forza text-[10px]
      },
    },
  },
  plugins: [],
};