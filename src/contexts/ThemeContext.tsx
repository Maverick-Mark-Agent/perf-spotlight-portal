import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'perf-spotlight-theme';

/**
 * ThemeProvider - Centralized theme management for the entire application
 * 
 * Features:
 * - Supports light, dark, and system preference modes
 * - Persists user preference to localStorage
 * - Automatically detects and responds to system theme changes
 * - Applies the 'dark' class to document root for Tailwind dark mode
 * 
 * Usage:
 * 1. Wrap your app with <ThemeProvider>
 * 2. Use useTheme() hook in any component to access/change theme
 * 3. Use ThemeToggle component for UI controls
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or default to 'dark'
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored || 'dark'; // Default to dark mode
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark'); // Start with dark

  // Get system preference
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Update the actual theme applied to the document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Determine which theme to actually use
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(effectiveTheme);
    
    // Apply or remove dark class
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    
    // Optional: Set data attribute for more specific targeting
    root.setAttribute('data-theme', effectiveTheme);
    
  }, [theme]);

  // Listen for system theme changes when theme is set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const newSystemTheme = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(newSystemTheme);
      
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newSystemTheme);
      root.setAttribute('data-theme', newSystemTheme);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme - Hook to access and control theme
 * 
 * Returns:
 * - theme: Current theme setting ('light' | 'dark' | 'system')
 * - resolvedTheme: The actual theme being used ('light' | 'dark')
 * - setTheme: Function to change the theme
 * 
 * Example:
 * ```tsx
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * 
 * // Change to dark mode
 * setTheme('dark');
 * 
 * // Follow system preference
 * setTheme('system');
 * 
 * // Check which theme is actually active
 * console.log(resolvedTheme); // 'light' or 'dark'
 * ```
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
