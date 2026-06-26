import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#1CB0C8",
          dark: "#1899B0",
          light: "#DDF8FC",
        },
        coral: {
          DEFAULT: "#FF9600",
          dark: "#E08600",
          light: "#FFF4E5",
        },
        sky: "#E8F7FA",
        ink: {
          DEFAULT: "#3C3C3C",
          light: "#777777",
          muted: "#777777",
        },
        border: "#E5E5E5",
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#E8F7FA",
          border: "#E5E5E5",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        display: ["var(--font-nunito)", "Nunito", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 2px 0 #E5E5E5",
        "card-hover": "0 6px 0 #E5E5E5",
        "btn-primary": "0 4px 0 #1899B0",
        "btn-secondary": "0 4px 0 #E5E5E5",
      },
    },
  },
  plugins: [],
};

export default config;
