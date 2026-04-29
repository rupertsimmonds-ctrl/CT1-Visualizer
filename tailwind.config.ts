import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: { DEFAULT: "#1F343F" },
        denim: "#2C537A",
        powder: "#7BA0B2",
        sand: "#D9B9A0",
        mist: "#EDE8E4",
        salmon: "#FF787A",
        terra: "#A06767",
        paper: "#F7F4F1",
        afterlight: "#210302",
        afterlight2: "#2E0F0A",
        gold: { DEFAULT: "#D7A86F", dark: "#B88949" },
        sun: "#D3BC9C",
        haze: "#F4F2EE",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,52,63,0.08), 0 4px 12px rgba(31,52,63,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
