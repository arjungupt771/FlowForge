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
        canvas: "#0a0a0f",
        surface: "#111118",
        panel: "#16161f",
        border: "#1e1e2e",
        accent: {
          purple: "#7c3aed",
          "purple-light": "#a78bfa",
          "purple-glow": "#7c3aed33",
        },
        node: {
          bg: "#1a1a27",
          header: "#13131e",
          border: "#2a2a3d",
          "border-active": "#7c3aed",
        },
        text: {
          primary: "#e2e2f0",
          secondary: "#8b8ba7",
          muted: "#4a4a6a",
        },
        status: {
          success: "#22c55e",
          error: "#ef4444",
          warning: "#f59e0b",
          running: "#7c3aed",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-glow": "pulseGlow 1.5s ease-in-out infinite",
        "edge-flow": "edgeFlow 1.5s linear infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(124, 58, 237, 0)",
            borderColor: "#7c3aed",
          },
          "50%": {
            boxShadow: "0 0 20px 4px rgba(124, 58, 237, 0.4)",
            borderColor: "#a78bfa",
          },
        },
        edgeFlow: {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideIn: {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle, #1e1e2e 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "24px 24px",
      },
    },
  },
  plugins: [],
};

export default config;
