/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "usv-blue": "#172554", // blue-950
        "usv-dark": "#1E293B", // slate-800
        "usv-accent": "#93C5FD", // blue-300 (New accent color replacing gold)
        "usv-gold": "#93C5FD", // Mapping old gold class to blue-300 for compatibility
        "usv-gray": "#F4F4F5", // zinc-100
        "usv-slate": "#334155", // slate-700
        "usv-slate-light": "#64748B",
        "usv-neutral": "#F8FAFC", // slate-50
        "usv-light": "#ffffff",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
