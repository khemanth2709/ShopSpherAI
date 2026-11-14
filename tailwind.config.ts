import type { Config } from 'tailwindcss';

const config: Config = {
  safelist: ['from-slate-100','to-zinc-200','from-stone-100','to-amber-100','from-sky-50','to-blue-100','from-emerald-50','to-teal-100','from-rose-50','to-orange-100','from-violet-50','to-purple-100','from-yellow-50','to-amber-100','from-cyan-50','to-sky-100'],
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18231d',
        sage: '#dce7d9',
        moss: '#49634f',
        cream: '#f7f7f2',
        lime: '#c6f277'
      },
      boxShadow: {
        soft: '0 16px 45px rgba(24, 35, 29, 0.08)',
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
