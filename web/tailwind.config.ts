import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf6e9',
          100: '#faebcc',
          500: '#ea9518',
          600: '#d4830f',
          700: '#b8710a',
        },
      },
    },
  },
  plugins: [],
};
export default config;
