/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        poppins: ['"Poppins"', 'sans-serif'],
      },
      colors: {
        nytro: {
          mint: '#2DD4BF', // Teal-400 approx
          blue: '#2563EB', // Blue-600 approx
          dark: '#0F172A', // Slate-900
          light: '#F8FAFC', // Slate-50
        },
        // Design system color tokens (can reference CSS variables for theming)
        primary: 'var(--color-primary, #3b82f6)',
        'primary-hover': 'var(--color-primary-hover, #2563eb)',
      },
      textColor: {
        'theme-primary': 'var(--text-primary, #1e293b)',
        'theme-secondary': 'var(--text-secondary, #64748b)',
        'theme-muted': 'var(--text-muted, #94a3b8)',
      },
      backgroundColor: {
        'theme-primary': 'var(--bg-primary, #f8f9fb)',
        'theme-card': 'var(--bg-card, #ffffff)',
      },
      borderColor: {
        'theme-primary': 'var(--border-primary, #dbeafe)',
        'theme-secondary': 'var(--border-secondary, #e2e8f0)',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'strong': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: [],
}
