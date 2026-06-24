import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        page: '#FAFAF7',
        ink: '#151515',
        line: '#E5E7DA',
        pitch: '#1F7A45',
        trophy: '#D6A93B',
      },
    },
  },
  plugins: [],
};

export default config;
