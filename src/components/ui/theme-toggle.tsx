import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

/**
 * ThemeToggle - A simple toggle button for switching between light and dark themes
 * 
 * Features:
 * - One-click toggle between light and dark modes
 * - Visual icons (Sun for light, Moon for dark)
 * - Smooth transitions
 * - Accessible with aria-label
 * 
 * Usage:
 * ```tsx
 * import { ThemeToggle } from '@/components/ui/theme-toggle';
 * 
 * // In your layout or navigation
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="relative transition-colors hover:bg-accent"
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
