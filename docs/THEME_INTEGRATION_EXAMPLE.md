# Quick Theme Integration Example

This demonstrates how to add the theme toggle to your navigation/header.

## Option 1: Add to MainLayout (Recommended)

```tsx
// src/components/layout/MainLayout.tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function MainLayout({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex justify-between items-center py-4">
          <h1>Your App</h1>
          
          {/* Add theme toggle here */}
          <ThemeToggle />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

## Option 2: Simple Toggle (Just Icon, No Dropdown)

```tsx
import { SimpleThemeToggle } from '@/components/ui/theme-toggle';

<SimpleThemeToggle />
```

## Option 3: Custom Implementation

```tsx
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

function MyCustomToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  
  return (
    <button 
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-md hover:bg-accent"
    >
      {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
```

## Testing the Theme System

1. Start your dev server: `npm run dev`
2. The app now starts in "system" mode (follows OS preference)
3. Add `<ThemeToggle />` to any component
4. Click it to switch between Light/Dark/System modes
5. Your preference is automatically saved!

## Available Components

- `<ThemeToggle />` - Full dropdown with Light/Dark/System options
- `<SimpleThemeToggle />` - Simple icon toggle (Light ↔ Dark only)
- `useTheme()` - Hook for programmatic theme access

Enjoy your new theme system! 🎨
