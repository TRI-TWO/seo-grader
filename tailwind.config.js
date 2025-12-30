/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // TRI-TWO Brand Colors
        'laser-blue': '#2F80FF',
        'mint-signal': '#2ED3B7',
        'amber-warning': '#F5A524',
        'critical-red': '#E5484D',
        'void-black': '#0A0D12',
        'obsidian': '#121622',
        'steel-gray': '#2A3142',
        'cool-ash': '#8C93A8',
        'light-blue-tint': '#BFD3FF',
      },
      fontFamily: {
        'norwester': ['Norwester', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

