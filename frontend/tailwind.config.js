/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      colors: {
        // Clean off-white canvas + near-neutral surfaces (warmth lives in the accents)
        canvas: "#f4f4f2",
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f7f7f5",
          sunken: "#ebebe8",
        },
        // Text — plum-tinted neutrals for cohesion with the rail
        ink: {
          DEFAULT: "#221e33",
          soft: "#4c4763",
        },
        muted: {
          DEFAULT: "#7c7591",
          soft: "#a8a2bc",
        },
        // Hairlines / borders (warm)
        line: {
          DEFAULT: "#ece6d8",
          strong: "#dbd4c4",
        },
        // Dark plum operational rail
        sidebar: {
          DEFAULT: "#2a2340",
          raised: "#352c50",
          line: "#3f3559",
          text: "#eae6f5",
          muted: "#9990b5",
        },
        // Brand — a readable violet (for text/links/focus + strong fills)
        brand: {
          DEFAULT: "#7c5cd6",
          hover: "#6a49c4",
          soft: "#efeafc",
          ink: "#2e2348",
          ring: "#c9b6f6",
        },
        // Lilac — the signature light lavender FILL (paired with dark text):
        // active nav pill, primary buttons, soft accents.
        lilac: {
          DEFAULT: "#c9b6f6",
          hover: "#b9a2f0",
          soft: "#e9e1fb",
          ink: "#2e2348",
        },
        // Peach / coral secondary accent (route nodes, driver actions)
        peach: {
          DEFAULT: "#ec9a82",
          soft: "#fbe4d9",
          ink: "#b5573c",
        },
        // Gold (calendar, warm highlights)
        gold: {
          DEFAULT: "#f0d58c",
          soft: "#fbf0d4",
          ink: "#8a6a1e",
        },
        // Semantic (safety-critical — always paired with label/icon)
        success: {
          DEFAULT: "#16a06b",
          soft: "#e6f7ef",
          ink: "#0e7a4b",
          border: "#bfebd5",
        },
        warning: {
          DEFAULT: "#d69a2e",
          soft: "#fcf1da",
          ink: "#8a6310",
          border: "#f2dea8",
        },
        danger: {
          DEFAULT: "#e0654e",
          soft: "#fce8e2",
          ink: "#b23f2a",
          border: "#f6cdbf",
        },
        info: {
          DEFAULT: "#4f6bea",
          soft: "#eaedfd",
          ink: "#34409c",
          border: "#cbd3fa",
        },
        // FEFO expiry heat scale (inventory)
        fefo: {
          expired: "#e0402f",
          d30: "#e8a100",
          d90: "#c9a227",
          d180: "#7ba05b",
          fresh: "#9099a4",
        },
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, #f4dda0 0%, #eccfe0 55%, #d9c2f3 100%)",
        "gradient-feature": "linear-gradient(135deg, #d8c6f5 0%, #e3ae9b 100%)",
        "gradient-lilac": "linear-gradient(135deg, #ded2fa 0%, #c9b6f6 100%)",
      },
      boxShadow: {
        "elev-1": "0 1px 2px rgba(42,35,64,.05), 0 2px 6px rgba(42,35,64,.06)",
        "elev-2": "0 8px 20px rgba(42,35,64,.10)",
        "elev-3": "0 20px 48px rgba(42,35,64,.20)",
        soft: "0 12px 30px rgba(42,35,64,.07)",
        "focus-brand": "0 0 0 3px rgba(124,92,214,0.35)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.07)" },
          "100%": { transform: "scale(1)" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-5px)" },
          "40%,80%": { transform: "translateX(5px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(124,92,214,0.35)" },
          "70%": { boxShadow: "0 0 0 8px rgba(124,92,214,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(124,92,214,0)" },
        },
        "grow-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        "fade-in-up": "fade-in-up .42s cubic-bezier(0.2,0.8,0.2,1) both",
        "scale-in": "scale-in .22s cubic-bezier(0.2,0.8,0.2,1) both",
        "slide-in-right": "slide-in-right .3s cubic-bezier(0.2,0.8,0.2,1) both",
        "slide-in-left": "slide-in-left .3s cubic-bezier(0.2,0.8,0.2,1) both",
        "slide-up": "slide-up .28s cubic-bezier(0.2,0.8,0.2,1) both",
        pop: "pop .3s cubic-bezier(0.2,0.8,0.2,1)",
        shake: "shake .4s cubic-bezier(0.2,0.8,0.2,1)",
        shimmer: "shimmer 1.6s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.2,0.8,0.2,1) infinite",
        "grow-x": "grow-x .7s cubic-bezier(0.2,0.8,0.2,1) both",
      },
    },
  },
  plugins: [],
};
