/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './resources/views/**/*.php',
    './resources/js/**/*.js',
    './src/**/*.php',
    './index.php',
  ],
  safelist: [
    // General utility classes that might be dynamically generated or used in the app
    'flex', 'hidden', 'block', 'inline-block', 'grid', 'gap-4', 'p-4', 'm-4',
    // Backgrounds
    'bg-blue-500/10',
    'bg-emerald-500/10',
    'bg-orange-500/10',
    'bg-amber-500/10',
    // Text colors
    'text-blue-500',
    'text-emerald-500',
    'text-orange-500',
    'text-amber-500',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Quicksand', 'sans-serif'],
      },
      // App-wide type scale — each size sits about half a step above
      // Tailwind's default (e.g. text-sm 14px -> 15px, text-base 16px ->
      // 17px) so text reads a little larger on every page, while keeping
      // Tailwind's line-height ratios. Tune these to resize text globally.
      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.125rem' }],  // 13px (default 12)
        'sm':   ['0.9375rem', { lineHeight: '1.375rem' }],  // 15px (default 14)
        'base': ['1.0625rem', { lineHeight: '1.625rem' }],  // 17px (default 16)
        'lg':   ['1.1875rem', { lineHeight: '1.75rem' }],   // 19px (default 18)
        'xl':   ['1.375rem',  { lineHeight: '1.875rem' }],  // 22px (default 20)
        '2xl':  ['1.6875rem', { lineHeight: '2.125rem' }],  // 27px (default 24)
        '3xl':  ['2.0625rem', { lineHeight: '2.5rem' }],    // 33px (default 30)
        '4xl':  ['2.5rem',    { lineHeight: '2.75rem' }],   // 40px (default 36)
        '5xl':  ['3.25rem',   { lineHeight: '1' }],         // 52px (default 48)
      },
      colors: {
        // PRIMARY: Based off #FC832B (Vibrant Orange)
        primary: {
          '50': '#fff8ed',
          '100': '#ffefd4',
          '200': '#ffdbab',
          '300': '#ffbe76',
          '400': '#fc832b', // Base color
          '500': '#f97316',
          '600': '#ea580c',
          '700': '#c2410c',
          '800': '#9a3412',
          '900': '#7c2d12',
          '950': '#431407',
        },
        // SECONDARY: Based off #284389 (Royal Navy)
        secondary: {
          '50': '#f1f5f9',
          '100': '#e2e8f0',
          '200': '#cfd9e7',
          '300': '#adbed8',
          '400': '#284389', // Base color
          '500': '#213872',
          '600': '#1b2d5c',
          '700': '#152349',
          '800': '#101a37',
          '900': '#0d152a',
          '950': '#070b16',
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}