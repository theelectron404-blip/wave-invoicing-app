import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        wave: {
          blue: "#0070f3",
          dark: "#0a0a0a",
          light: "#f5f5f5",
          accent: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};
export default config;
