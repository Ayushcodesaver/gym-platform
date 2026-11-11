/** Design tokens (docs/desgin md §43–49) — dark-first, orange accent, no green/purple. */
export const theme = {
  bg: "#0B0D10",
  surface: "#12161B",
  elevated: "#181D23",
  border: "#222831",
  textHi: "#F5F5F5",
  textMid: "#A7ADB5",
  textLow: "#6F767F",
  accent: "#F97316",
  accentHover: "#EA580C",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
