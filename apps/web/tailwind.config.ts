import type { Config } from "tailwindcss";

/** Design tokens from docs/desgin md §43–49. No purple/green anywhere. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0B0D10",
        surface: "#12161B",
        elevated: "#181D23",
        line: "#222831",
        "text-hi": "#F5F5F5",
        "text-mid": "#A7ADB5",
        "text-low": "#6F767F",
        accent: { DEFAULT: "#F97316", hover: "#EA580C" },
        warning: "#F59E0B",
        danger: "#EF4444",
        light: { bg: "#F7F7F5", surface: "#FFFFFF", line: "#E5E7EB", "text-hi": "#17191C", "text-mid": "#626871" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"] },
      fontSize: {
        display: ["2rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h1: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h2: ["1.375rem", { lineHeight: "1.3" }],
        h3: ["1.125rem", { lineHeight: "1.4" }],
        base: ["0.9375rem", { lineHeight: "1.5" }],
        small: ["0.8125rem", { lineHeight: "1.5" }],
        caption: ["0.71875rem", { lineHeight: "1.4", letterSpacing: "0.05em" }],
      },
      borderRadius: { btn: "10px", card: "14px", modal: "16px" },
      spacing: {
        4.5: "18px",
      },
    },
  },
  plugins: [],
};
export default config;
