tailwind.config = {
  content: ['./index.html', './src/**/*.{tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        civic: '#2155FF',
        gold: '#F7B339',
        slate: {
          50: '#F5F7FA',
        },
        // keep existing palette
        'civic-blue': '#2155FF',
        'sunlight-gold': '#F7B339',
        'midnight-navy': '#1A2138',
        'slate-100': '#F5F7FA',
        'brand-red': '#C7002B',
        'brand-dark-blue': '#1E3A5F',
        'brand-medium-blue': '#5A7698',
        'brand-light-blue-grey': '#A8B4C3',
        'brand-off-white': '#E9EAEF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Nunito Sans"', 'sans-serif'],
        heading: ['"Archivo Black"', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
      borderRadius: {
        card: '1rem',
      },
      screens: {
        xs: '480px',
      },
      fontSize: {
        h1: ['clamp(2rem,5vw,3rem)', { lineHeight: '1.1' }],
        h2: ['clamp(1.5rem,4vw,2.25rem)', { lineHeight: '1.2' }],
        h3: ['clamp(1.25rem,3vw,1.875rem)', { lineHeight: '1.3' }],
      },
    },
  },
}
