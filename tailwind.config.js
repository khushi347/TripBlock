/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'light-bg': '#F4F6F9',
        'surface-card': '#FFFFFF',
        'card-border': '#E2E8F0',
        'brand-green': '#2E7D32', // Softer, fresh agricultural green
        'brand-green-hover': '#1B5E20', // Deep green for hover/contrast
        'brand-green-light': '#E8F5E9', // Very soft light green background highlights
        'accent-green': '#4CAF50', // Vibrant green
        'text-primary': '#1E293B', // Slate 800 for clean text
        'text-secondary': '#475569', // Slate 600
        'text-muted': '#64748B', // Slate 500
        'warning-orange': '#D97706', // Warm amber
        'warning-orange-light': '#FEF3C7',
        'danger-red': '#DC2626', // Clean red
        'danger-red-light': '#FEE2E2',
        'success-green': '#16A34A', // Success badge green
        'success-green-light': '#DCFCE7',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sonar': 'sonar 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        sonar: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
