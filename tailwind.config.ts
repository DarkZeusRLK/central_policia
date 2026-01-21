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
        "bg-color": "#0a0e17",
        "primary-blue": "#1e3a8a",
        "accent-gold": "#fbbf24",
        "glass-bg": "rgba(20, 25, 40, 0.7)",
        "glass-border": "rgba(255, 255, 255, 0.1)",
        "text-main": "#ffffff",
        "text-muted": "#94a3b8",
        danger: "#ef4444",
        success: "#10b981",
      },
      fontFamily: {
        sans: ["Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
