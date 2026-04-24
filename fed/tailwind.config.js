/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- NEW "Midnight Slate" DARK THEME PALETTE ---
        'dark-bg': '#0F172A',       // A deep, cool slate blue-gray
        'dark-surface': '#1E293B',    // A slightly lighter slate for cards
        'dark-border': 'rgba(255, 255, 255, 0.1)', // Subtle border for glass effect
        'dark-text': '#E2E8F0',       // A soft, cool-toned white
        'dark-subtle': '#94A3B8',      // A slate gray for secondary text
        'dark-primary': '#38BDF8',      // A vibrant, electric sky blue for accents

        // --- Your existing Light Theme (no changes needed) ---
        'brand-bg': '#F9FAFB',
        'brand-surface': '#FFFFFF',
        'brand-text': '#1F2937',
        'brand-subtle': '#6B7280',
        'brand-primary': '#6D28D9',
      }
    },
  },
  plugins: [],
}