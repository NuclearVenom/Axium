/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#121314",   // graph canvas / app shell background
          light: "#faf8f4",     // warm off-white
        },
        panel: {
          DEFAULT: "#191A1B",   // side panel — deliberately a shade lighter than canvas for contrast
        },
        surface: {
          DEFAULT: "#131315",
          light: "#f2efe9",
        },
        border: {
          DEFAULT: "#212125",
          light: "#e5e0d6",
        },
        ink: {
          DEFAULT: "#ededf0",
          muted: "#8b8b93",
          light: "#1c1b19",
          "light-muted": "#6b675f",
        },
        accent: {
          DEFAULT: "#7c8cff",
          soft: "#5865d8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "drift": "drift 40s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        drift: {
          "0%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(2%, 1.5%)" },
          "100%": { transform: "translate(0, 0)" },
        },
      },
    },
  },
  plugins: [typography],
};
