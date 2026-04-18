import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#17150f",
          2: "#3a3835",
          3: "#6b6660",
          4: "#a39d93",
        },
        paper: "#fdfcf8",
        rule: {
          DEFAULT: "#e5e2da",
          strong: "#cfcac1",
        },
        accent: {
          DEFAULT: "#5b21b6",
          soft: "#f1ebfa",
          line: "#c7b2e3",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        bn: ["var(--font-bn)", "system-ui", "sans-serif"],
        "bn-serif": ["var(--font-bn-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        "tracked-sm": "0.14em",
        tracked: "0.2em",
        "tracked-lg": "0.28em",
      },
    },
  },
  plugins: [],
};

export default config;
