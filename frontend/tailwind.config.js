/** Design-system tokens — Apple pro-tool calm + Swiggy/Zomato life.
 *
 *  Every colour resolves to a CSS custom-property channel (R G B), so the entire
 *  app can be re-themed at runtime — light/dark, high-contrast, and colour-blind-safe
 *  palettes — without touching a single component. The channel values (and their
 *  per-theme overrides) live in src/index.css. Font sizes multiply by --fs so the
 *  accessibility font-scale setting scales all token text. */

/** @type {import('tailwindcss').Config} */
const ch = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: ch("--c-app"),
        surface: ch("--c-surface"),
        subtle: ch("--c-subtle"),
        border: { subtle: ch("--c-border-subtle"), strong: ch("--c-border-strong") },
        text: {
          primary: ch("--c-text-primary"),
          secondary: ch("--c-text-secondary"),
          tertiary: ch("--c-text-tertiary"),
        },
        accent: {
          DEFAULT: ch("--c-accent"),
          hover: ch("--c-accent-hover"),
          soft: ch("--c-accent-soft"),
          ring: ch("--c-accent-ring"),
        },
        success: { DEFAULT: ch("--c-success"), fg: ch("--c-success-fg"), bg: ch("--c-success-bg") },
        danger: { DEFAULT: ch("--c-danger"), fg: ch("--c-danger-fg"), bg: ch("--c-danger-bg") },
        warning: { DEFAULT: ch("--c-warning"), fg: ch("--c-warning-fg"), bg: ch("--c-warning-bg") },
        info: { DEFAULT: ch("--c-info"), fg: ch("--c-info-fg"), bg: ch("--c-info-bg") },
        fefo: {
          expired: ch("--c-fefo-expired"),
          le30: ch("--c-fefo-le30"),
          le90: ch("--c-fefo-le90"),
          le180: ch("--c-fefo-le180"),
          fresh: ch("--c-fefo-fresh"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      // Sizes multiply by the accessibility font-scale (--fs); line-heights are unitless so they scale too.
      fontSize: {
        micro: ["calc(11px * var(--fs, 1))", { lineHeight: "1.27", fontWeight: "600", letterSpacing: "0.06em" }],
        caption: ["calc(12px * var(--fs, 1))", { lineHeight: "1.33" }],
        body: ["calc(14px * var(--fs, 1))", { lineHeight: "1.43" }],
        subtitle: ["calc(16px * var(--fs, 1))", { lineHeight: "1.5" }],
        title: ["calc(20px * var(--fs, 1))", { lineHeight: "1.4" }],
        display: ["calc(28px * var(--fs, 1))", { lineHeight: "1.21" }],
      },
      borderRadius: { md: "8px", xl: "12px", "2xl": "16px" },
      boxShadow: {
        "elev-1": "0 1px 2px rgba(16,20,24,.04), 0 1px 3px rgba(16,20,24,.06)",
        "elev-2": "0 4px 12px rgba(16,20,24,.08)",
        "elev-3": "0 16px 48px rgba(16,20,24,.18)",
      },
      transitionTimingFunction: { ease: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "slide-up": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "slide-in-right": { from: { opacity: 0, transform: "translateX(16px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in .2s cubic-bezier(0.2,0.8,0.2,1)",
        "slide-up": "slide-up .24s cubic-bezier(0.2,0.8,0.2,1)",
        "slide-in-right": "slide-in-right .28s cubic-bezier(0.2,0.8,0.2,1)",
      },
    },
  },
  plugins: [],
};
