import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      /* === NEXUS COLOR SYSTEM === */
      colors: {
        /* Core Semantic Tokens */
        border: "hsl(var(--border))",
        "border-input": "hsl(var(--border-input))",
        "border-focus": "hsl(var(--border-focus))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        
        /* Surface System */
        background: {
          DEFAULT: "hsl(var(--background))",
          elevated: "hsl(var(--background-elevated))",
          panel: "hsl(var(--background-panel))",
          overlay: "hsl(var(--background-overlay))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          muted: "hsl(var(--foreground-muted))",
          subtle: "hsl(var(--foreground-subtle))",
        },
        
        /* Interactive Elements */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          hover: "hsl(var(--secondary-hover))",
          active: "hsl(var(--secondary-active))",
        },
        
        /* Feedback System */
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          surface: "hsl(var(--destructive-surface))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          surface: "hsl(var(--success-surface))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          surface: "hsl(var(--warning-surface))",
        },
        
        /* Component Tokens */
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          border: "hsl(var(--card-border))",
        },
        
        /* NEXUS Primitive Colors */
        nexus: {
          neural: {
            50: "hsl(var(--nexus-neural-50))",
            100: "hsl(var(--nexus-neural-100))",
            200: "hsl(var(--nexus-neural-200))",
            300: "hsl(var(--nexus-neural-300))",
            400: "hsl(var(--nexus-neural-400))",
            500: "hsl(var(--nexus-neural-500))",
            600: "hsl(var(--nexus-neural-600))",
            700: "hsl(var(--nexus-neural-700))",
            800: "hsl(var(--nexus-neural-800))",
            900: "hsl(var(--nexus-neural-900))",
          },
          cognitive: {
            50: "hsl(var(--nexus-cognitive-50))",
            100: "hsl(var(--nexus-cognitive-100))",
            200: "hsl(var(--nexus-cognitive-200))",
            300: "hsl(var(--nexus-cognitive-300))",
            400: "hsl(var(--nexus-cognitive-400))",
            500: "hsl(var(--nexus-cognitive-500))",
            600: "hsl(var(--nexus-cognitive-600))",
            700: "hsl(var(--nexus-cognitive-700))",
            800: "hsl(var(--nexus-cognitive-800))",
            900: "hsl(var(--nexus-cognitive-900))",
          },
          synaptic: {
            50: "hsl(var(--nexus-synaptic-50))",
            100: "hsl(var(--nexus-synaptic-100))",
            200: "hsl(var(--nexus-synaptic-200))",
            300: "hsl(var(--nexus-synaptic-300))",
            400: "hsl(var(--nexus-synaptic-400))",
            500: "hsl(var(--nexus-synaptic-500))",
            600: "hsl(var(--nexus-synaptic-600))",
            700: "hsl(var(--nexus-synaptic-700))",
            800: "hsl(var(--nexus-synaptic-800))",
            900: "hsl(var(--nexus-synaptic-900))",
          },
          alert: {
            50: "hsl(var(--nexus-alert-50))",
            100: "hsl(var(--nexus-alert-100))",
            200: "hsl(var(--nexus-alert-200))",
            300: "hsl(var(--nexus-alert-300))",
            400: "hsl(var(--nexus-alert-400))",
            500: "hsl(var(--nexus-alert-500))",
            600: "hsl(var(--nexus-alert-600))",
            700: "hsl(var(--nexus-alert-700))",
            800: "hsl(var(--nexus-alert-800))",
            900: "hsl(var(--nexus-alert-900))",
          },
          critical: {
            50: "hsl(var(--nexus-critical-50))",
            100: "hsl(var(--nexus-critical-100))",
            200: "hsl(var(--nexus-critical-200))",
            300: "hsl(var(--nexus-critical-300))",
            400: "hsl(var(--nexus-critical-400))",
            500: "hsl(var(--nexus-critical-500))",
            600: "hsl(var(--nexus-critical-600))",
            700: "hsl(var(--nexus-critical-700))",
            800: "hsl(var(--nexus-critical-800))",
            900: "hsl(var(--nexus-critical-900))",
          },
          slate: {
            50: "hsl(var(--nexus-slate-50))",
            100: "hsl(var(--nexus-slate-100))",
            200: "hsl(var(--nexus-slate-200))",
            300: "hsl(var(--nexus-slate-300))",
            400: "hsl(var(--nexus-slate-400))",
            500: "hsl(var(--nexus-slate-500))",
            600: "hsl(var(--nexus-slate-600))",
            700: "hsl(var(--nexus-slate-700))",
            800: "hsl(var(--nexus-slate-800))",
            900: "hsl(var(--nexus-slate-900))",
          },
        },
        
        /* Sidebar System */
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      
      /* === SPACING SYSTEM === */
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
        '20': 'var(--space-20)',
        '24': 'var(--space-24)',
      },
      
      /* === TYPOGRAPHY SYSTEM === */
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        body: ['system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', '0.875rem'],   /* 10px/14px */
        xs: ['0.75rem', '1rem'],          /* 12px/16px */
        sm: ['0.875rem', '1.25rem'],      /* 14px/20px */
        base: ['1rem', '1.5rem'],         /* 16px/24px */
        lg: ['1.125rem', '1.75rem'],      /* 18px/28px */
        xl: ['1.25rem', '1.75rem'],       /* 20px/28px */
        '2xl': ['1.5rem', '2rem'],        /* 24px/32px */
        '3xl': ['1.875rem', '2.25rem'],   /* 30px/36px */
        '4xl': ['2.25rem', '2.5rem'],     /* 36px/40px */
        '5xl': ['3rem', '1'],             /* 48px */
        '6xl': ['3.75rem', '1'],          /* 60px */
      },
      
      /* === BORDER RADIUS SYSTEM === */
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
        hexagon: "var(--radius-hexagon)",
      },
      
      /* === BOX SHADOW SYSTEM === */
      boxShadow: {
        connection: "var(--shadow-connection)",
        "data-node": "var(--shadow-data-node)",
        elevated: "var(--shadow-elevated)",
        floating: "var(--shadow-floating)",
      },
      /* === ANIMATION SYSTEM === */
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        moderate: 'var(--duration-moderate)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        nexus: 'var(--easing-nexus)',
        enter: 'var(--easing-enter)',
        exit: 'var(--easing-exit)',
        spring: 'var(--easing-spring)',
      },
      keyframes: {
        /* Legacy Accordion */
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        
        /* NEXUS Signature Animations */
        "nexus-pulse": {
          "0%, 100%": { 
            opacity: "0.4", 
            transform: "translateY(-50%) scaleX(1)" 
          },
          "50%": { 
            opacity: "1", 
            transform: "translateY(-50%) scaleX(1.05)" 
          },
        },
        "nexus-flow": {
          "0%": { 
            transform: "translateY(-50%) translateX(-100%)", 
            opacity: "0" 
          },
          "50%": { opacity: "1" },
          "100%": { 
            transform: "translateY(-50%) translateX(100%)", 
            opacity: "0" 
          },
        },
        "nexus-glow": {
          "0%": { boxShadow: "var(--shadow-data-node)" },
          "50%": { boxShadow: "var(--shadow-connection), var(--shadow-floating)" },
          "100%": { boxShadow: "var(--shadow-data-node)" },
        },
        "nexus-connect": {
          "0%": { strokeDashoffset: "100", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { strokeDashoffset: "0", opacity: "1" },
        },
        "nexus-data-flow": {
          "0%": { 
            transform: "translateX(-100%) scale(0)", 
            opacity: "0" 
          },
          "10%": { 
            transform: "translateX(-80%) scale(0.5)", 
            opacity: "0.5" 
          },
          "50%": { 
            transform: "translateX(0%) scale(1)", 
            opacity: "1" 
          },
          "90%": { 
            transform: "translateX(80%) scale(0.5)", 
            opacity: "0.5" 
          },
          "100%": { 
            transform: "translateX(100%) scale(0)", 
            opacity: "0" 
          },
        },
        
        /* Enhanced UI Animations */
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        /* Legacy */
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        
        /* NEXUS Signature */
        "nexus-pulse": "nexus-pulse 2s ease-in-out infinite",
        "nexus-flow": "nexus-flow 3s ease-in-out infinite",
        "nexus-glow": "nexus-glow 0.6s ease-out",
        "nexus-connect": "nexus-connect 1.2s var(--easing-nexus) forwards",
        "nexus-data-flow": "nexus-data-flow 2s var(--easing-nexus) infinite",
        
        /* Enhanced UI */
        "fade-in": "fade-in 0.3s var(--easing-enter)",
        "slide-up": "slide-up 0.4s var(--easing-enter)",
        "scale-in": "scale-in 0.2s var(--easing-spring)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
