const { BREAKPOINTS, CONTAINER_CONFIG } = require('./src/config/responsive.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		screens: BREAKPOINTS,
  		container: {
  			center: true,
  			padding: {
  				DEFAULT: CONTAINER_CONFIG.xs.padding,
  				xs: CONTAINER_CONFIG.xs.padding,
  				sm: CONTAINER_CONFIG.sm.padding,
  				md: CONTAINER_CONFIG.md.padding,
  				lg: CONTAINER_CONFIG.lg.padding,
  				xl: CONTAINER_CONFIG.xl.padding,
  				'2xl': CONTAINER_CONFIG['2xl'].padding,
  			},
  			screens: {
  				xs: CONTAINER_CONFIG.xs.maxWidth,
  				sm: CONTAINER_CONFIG.sm.maxWidth,
  				md: CONTAINER_CONFIG.md.maxWidth,
  				lg: CONTAINER_CONFIG.lg.maxWidth,
  				xl: CONTAINER_CONFIG.xl.maxWidth,
  				'2xl': CONTAINER_CONFIG['2xl'].maxWidth,
  			},
  		},
  		colors: {
  			background: 'rgb(var(--background))',
  			foreground: 'rgb(var(--foreground))',
  			card: {
  				DEFAULT: 'rgb(var(--card))',
  				foreground: 'rgb(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'rgb(var(--popover))',
  				foreground: 'rgb(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'rgb(var(--primary))',
  				foreground: 'rgb(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'rgb(var(--secondary))',
  				foreground: 'rgb(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'rgb(var(--muted))',
  				foreground: 'rgb(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'rgb(var(--accent))',
  				foreground: 'rgb(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'rgb(var(--destructive))',
  				foreground: 'rgb(var(--destructive-foreground))'
  			},
  			border: 'rgb(var(--border))',
  			input: 'rgb(var(--input))',
  			ring: 'rgb(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Pretendard Variable',
  				'Pretendard',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'system-ui',
  				'Roboto',
  				'Helvetica Neue',
  				'Segoe UI',
  				'Apple SD Gothic Neo',
  				'Noto Sans KR',
  				'Malgun Gothic',
  				'sans-serif'
  			],
  			serif: [
  				'Pretendard Variable',
  				'Pretendard',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'system-ui',
  				'Roboto',
  				'Helvetica Neue',
  				'Segoe UI',
  				'Apple SD Gothic Neo',
  				'Noto Sans KR',
  				'Malgun Gothic',
  				'serif'
  			],
  			mono: [
  				'Consolas',
  				'Monaco',
  				'Courier New',
  				'monospace'
  			]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'fade-in': {
  				'0%': { opacity: '0', transform: 'translateY(10px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			'slide-in-bottom': {
  				'0%': { opacity: '0', transform: 'translateY(16px)' },
  				'100%': { opacity: '1', transform: 'translateY(0)' }
  			},
  			'pulse-typing': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.5' }
  			},
  			'bounce-typing': {
  				'0%, 80%, 100%': { transform: 'scale(0)' },
  				'40%': { transform: 'scale(1)' }
  			}
  		},
  		animation: {
  			'fade-in': 'fade-in 0.3s ease-out',
  			'slide-in-bottom': 'slide-in-bottom 0.3s ease-out',
  			'pulse-typing': 'pulse-typing 1.4s infinite',
  			'bounce-typing': 'bounce-typing 1.4s infinite'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwind-scrollbar")({ nocompatible: true }),
  ],
}

