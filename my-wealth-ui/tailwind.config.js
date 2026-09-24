/** @type {import('tailwindcss').Config} */
export default {
  // On a phone, :hover sticks to whatever was last tapped, so a button stays
  // highlighted after the tap is over. Hover styles apply only on devices
  // that can actually hover.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Background
        bg: {
          primary: '#06111F',
          secondary: '#081827',
          surface: '#0B1D2E',
          card: '#0D2235',
          elevated: '#102A40',
        },
        // Border
        border: {
          DEFAULT: '#1C5265',
          soft: '#16384B',
        },
        // Accent
        cyan: '#22E6E0',
        emerald: '#20E58A',
        blue: '#248BFF',
        purple: '#8B7CFF',
        gold: '#E8C65A',
        coral: '#FF6B6B',
        warning: '#F5B942',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'Noto Sans Thai', 'sans-serif'],
      },
      borderRadius: {
        'xl': '20px',
        'lg': '16px',
        'md': '12px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34, 230, 224, 0.3)',
        'glow-emerald': '0 0 20px rgba(32, 229, 138, 0.3)',
      }
    }
  },
  plugins: []
}
