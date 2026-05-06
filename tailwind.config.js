/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          light: '#e8f0fe',
          hover: '#1557b0',
        },
        canvas: {
          bg: '#f8f9fa',
          dot: '#d0d5dd',
        },
        surface: '#ffffff',
      },
    },
  },
  plugins: [],
}
