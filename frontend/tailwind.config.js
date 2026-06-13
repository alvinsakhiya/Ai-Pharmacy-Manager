/** Design-system tokens — Apple pro-tool calm + Swiggy/Zomato life.
 *  Colours, type, radius, shadow and motion all map to the house language. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: "#F7F8FA",
        surface: "#FFFFFF",
        subtle: "#F0F2F5",
        border: { subtle: "#E6E8EC", strong: "#D2D6DC" },
        text: { primary: "#111418", secondary: "#5B6470", tertiary: "#9099A4" },
        accent: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          soft: "#EEF0FE",
          ring: "#A5B4FC",
        },
        success: { DEFAULT: "#15A463", fg: "#0E7A4B", bg: "#E7F6EE" },
        danger: { DEFAULT: "#E0402F", fg: "#B42318", bg: "#FDECEA" },
        warning: { DEFAULT: "#E8A100", fg: "#9A6A00", bg: "#FFF6E0" },
        info: { DEFAULT: "#2D74D6", fg: "#1F5AA8", bg: "#EAF1FB" },
        // FEFO expiry heat scale
        fefo: {
          expired: "#E0402F",
          le30: "#E8A100",
          le90: "#C9A227",
          le180: "#7BA05B",
          fresh: "#9099A4",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        micro: ["11px", { lineHeight: "14px", fontWeight: "600", letterSpacing: "0.06em" }],
        caption: ["12px", { lineHeight: "16px" }],
        body: ["14px", { lineHeight: "20px" }],
        subtitle: ["16px", { lineHeight: "24px" }],
        title: ["20px", { lineHeight: "28px" }],
        display: ["28px", { lineHeight: "34px" }],
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
