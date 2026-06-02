/** @type {import('tailwindcss').Config} */
export default {
  content: ["./entrypoints/**/*.{html,ts,tsx}", "./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
    },
  },
  plugins: [],
}
