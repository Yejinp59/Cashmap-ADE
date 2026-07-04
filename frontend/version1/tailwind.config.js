/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background:  "var(--background)",
        foreground:  "var(--foreground)",
        card: {
          DEFAULT:    "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT:    "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT:    "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT:    "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT:    "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT:    "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT:    "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border:      "var(--border)",
        input:       "var(--input)",
        ring:        "var(--ring)",

        // Status
        success: {
          DEFAULT:    "var(--success)",
          foreground: "var(--success-foreground)",
          muted:      "var(--success-muted)",
        },
        warning: {
          DEFAULT:    "var(--warning)",
          foreground: "var(--warning-foreground)",
          muted:      "var(--warning-muted)",
        },
        danger: {
          DEFAULT:    "var(--danger)",
          foreground: "var(--danger-foreground)",
          muted:      "var(--danger-muted)",
        },
        info: {
          DEFAULT:    "var(--info)",
          foreground: "var(--info-foreground)",
          muted:      "var(--info-muted)",
        },

        // Chart
        chart: {
          1: "var(--chart-1)",
          2: "var(--chart-2)",
          3: "var(--chart-3)",
          4: "var(--chart-4)",
          5: "var(--chart-5)",
        },

        // Sidebar
        sidebar: {
          DEFAULT:           "var(--sidebar)",
          foreground:        "var(--sidebar-foreground)",
          primary:           "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent:            "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border:            "var(--sidebar-border)",
          ring:              "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Noto Sans KR", "sans-serif"],
        mono: ["ui-monospace", "DM Mono", "Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
