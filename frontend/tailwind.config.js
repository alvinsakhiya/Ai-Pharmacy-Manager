/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        card: "var(--radius-card)",
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        "card-md": "var(--shadow-md)",
      },
      colors: {
        brand: {
          DEFAULT: "var(--brand)",
          strong: "var(--brand-strong)",
          soft: "var(--brand-soft)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
      },
    },
  },
  plugins: [],
};
