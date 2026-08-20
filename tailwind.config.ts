import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0A0D13",
          surface: "#12161F",
          surface2: "#171C27",
          border: "#232838",
          borderLight: "#2E3546",
        },
        ink: {
          primary: "#E8EAED",
          muted: "#8B93A7",
          faint: "#5B6478",
        },
        call: {
          DEFAULT: "#2DD4A7",
          dim: "#1B4A3E",
          bg: "#0E1F1A",
        },
        put: {
          DEFAULT: "#EF6351",
          dim: "#4A231C",
          bg: "#1F1210",
        },
        neutral: {
          DEFAULT: "#C9A227",
          dim: "#463A16",
          bg: "#1A1608",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        scan: "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)",
      },
    },
  },
  plugins: [],
};

export default config;
