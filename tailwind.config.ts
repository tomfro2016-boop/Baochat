import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        line: v('line'),
        primary: v('primary'),
        accent: v('accent'),
        ink: v('ink'),
        muted: v('muted'),
        danger: '#F0506E',
        ok: '#34D399',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--primary) / .45)',
        soft: '0 1px 2px rgb(0 0 0 / .18), 0 6px 20px -10px rgb(0 0 0 / .35)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        pulseDot: { '0%,80%,100%': { opacity: '.25', transform: 'scale(.8)' }, '40%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: { pulseDot: 'pulseDot 1.2s infinite ease-in-out', rise: 'rise .3s cubic-bezier(.22,1,.36,1) both' },
    },
  },
  plugins: [],
};

export default config;
