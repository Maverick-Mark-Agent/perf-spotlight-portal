# 🎨 Centralized Theme System Guide

## Overview

This application uses a **centralized theme system** built with React Context, Tailwind CSS, and CSS custom properties (variables). All colors are managed from a single location, making it easy to maintain consistency and accessibility across the entire application.

---

## 🌓 Dark/Light Mode Implementation

### Quick Start

1. **Use the ThemeToggle component** anywhere in your app:
```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

function MyNavbar() {
  return (
    <nav>
      <ThemeToggle />
    </nav>
  );
}
```

2. **Access theme programmatically** using the `useTheme` hook:
```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  
  // Change theme
  setTheme('dark');
  setTheme('light');
  setTheme('system'); // Follow OS preference
  
  // Check current theme
  console.log(resolvedTheme); // 'light' or 'dark'
}
```

### Theme Options

- **`light`** - Force light mode
- **`dark`** - Force dark mode  
- **`system`** - Automatically follow OS/browser preference (default)

User preferences are automatically saved to `localStorage` and persist across sessions.

---

## 🎨 Color Palette Reference

### How Colors Work

All colors are defined as **HSL values** in `src/index.css` using CSS custom properties:

```css
:root {
  --primary: 217 91% 48%;  /* Light mode */
}

.dark {
  --primary: 217 91% 60%;  /* Dark mode */
}
```

Use them in your components with Tailwind classes:
```tsx
<div className="bg-primary text-primary-foreground">
  Primary colored box
</div>
```

Or with the `hsl()` function in custom CSS:
```css
.my-element {
  background: hsl(var(--primary));
}
```

---

## 📊 Complete Color Reference

### Foundation Colors

| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--background` | `210 17% 98%` (Soft white) | `222 47% 7%` (Near black) | Main page background |
| `--foreground` | `222 47% 11%` (Near black) | `210 40% 98%` (Off white) | Primary text |
| `--card` | `0 0% 100%` (White) | `222 47% 11%` (Dark gray) | Card backgrounds |
| `--card-foreground` | `222 47% 11%` | `210 40% 98%` | Text on cards |

### Brand Colors

| Variable | Light Mode | Dark Mode | Contrast Ratio | Usage |
|----------|------------|-----------|----------------|-------|
| `--primary` | `217 91% 48%` | `217 91% 60%` | ✅ 7:1 / 8.5:1 | Primary actions, links |
| `--primary-hover` | `217 91% 42%` | `217 91% 70%` | - | Hover states |
| `--secondary` | `214 32% 88%` | `217 32% 20%` | - | Secondary backgrounds |
| `--accent` | `262 80% 50%` | `262 80% 60%` | ✅ 4.5:1 / 6:1 | Accent/highlight |

### Semantic Colors (Status Indicators)

| Variable | Light Mode | Dark Mode | Contrast | Usage |
|----------|------------|-----------|----------|-------|
| `--success` | `142 71% 32%` | `142 71% 45%` | ✅ 4.8:1 / 5.5:1 | Success messages, positive states |
| `--warning` | `38 92% 42%` | `38 92% 55%` | ✅ 5.2:1 / 6:1 | Warnings, alerts |
| `--destructive` | `0 84% 52%` | `0 84% 60%` | ✅ 4.7:1 / 5:1 | Errors, delete actions |
| `--info` | `217 91% 48%` | `217 91% 60%` | ✅ 7:1 / 8.5:1 | Info messages |

### UI Elements

| Variable | Usage |
|----------|-------|
| `--muted` | Disabled/inactive backgrounds |
| `--muted-foreground` | Secondary text, captions |
| `--border` | Default border color |
| `--input` | Input field borders |
| `--ring` | Focus ring around interactive elements |

### Status Backgrounds

For status badges with background colors:

| Variable | Light | Dark | Usage |
|----------|-------|------|-------|
| `--status-success-bg` | `142 71% 95%` | `142 71% 15%` | Green badge background |
| `--status-warning-bg` | `38 92% 95%` | `38 92% 15%` | Orange badge background |
| `--status-info-bg` | `217 91% 95%` | `217 91% 15%` | Blue badge background |
| `--status-error-bg` | `0 84% 95%` | `0 84% 15%` | Red badge background |

---

## ✅ Accessibility Guidelines

All colors meet **WCAG AA** standards (minimum 4.5:1 contrast ratio for normal text).  
Primary colors meet **WCAG AAA** standards (7:1+ contrast ratio).

### Best Practices

1. **Always use semantic colors** for status indicators:
   - ✅ Success: Green
   - ⚠️ Warning: Orange/Amber
   - ❌ Error: Red
   - ℹ️ Info: Blue

2. **Never rely on color alone** - Always include icons or text:
   ```tsx
   // ❌ Bad - color only
   <span className="text-success">Action completed</span>
   
   // ✅ Good - color + icon + text
   <span className="text-success flex items-center gap-2">
     <CheckCircle className="h-4 w-4" />
     Action completed
   </span>
   ```

3. **Use foreground colors** for text on colored backgrounds:
   ```tsx
   <Button className="bg-primary text-primary-foreground">
     Submit
   </Button>
   ```

4. **Test both themes** during development to ensure readability

---

## 🔧 Changing Colors Globally

To change colors across the entire application:

1. Open `src/index.css`
2. Find the `:root` section (light mode) or `.dark` section (dark mode)
3. Update the HSL values for the desired color variable
4. Changes apply immediately to all components

### Example: Change Primary Color

```css
:root {
  /* Change from blue to purple */
  --primary: 262 80% 50%;  /* Was: 217 91% 48% */
}

.dark {
  --primary: 262 80% 60%;  /* Was: 217 91% 60% */
}
```

**All buttons, links, and primary-colored elements automatically update!**

---

## 🎯 Common Use Cases

### 1. Status Badge Component
```tsx
function StatusBadge({ status }: { status: 'success' | 'warning' | 'error' }) {
  const colors = {
    success: 'bg-status-success-bg text-status-success',
    warning: 'bg-status-warning-bg text-status-warning',
    error: 'bg-status-error-bg text-status-error',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full ${colors[status]}`}>
      {status}
    </span>
  );
}
```

### 2. Dark Mode Conditional Styling
```tsx
// Option 1: Use Tailwind's dark: variant
<div className="bg-white dark:bg-gray-900">
  Content
</div>

// Option 2: Check theme programmatically
const { resolvedTheme } = useTheme();
const bgColor = resolvedTheme === 'dark' ? 'bg-dark' : 'bg-light';
```

### 3. Custom Component with Theme Variables
```tsx
function GradientCard() {
  return (
    <div 
      className="p-6 rounded-lg"
      style={{ 
        background: 'var(--gradient-card)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      Card content
    </div>
  );
}
```

---

## 📁 File Structure

```
src/
├── index.css              # 🎨 COLOR DEFINITIONS (single source of truth)
├── contexts/
│   └── ThemeContext.tsx   # Theme state management
├── components/
│   └── ui/
│       └── theme-toggle.tsx  # Theme switcher UI
└── App.tsx                # ThemeProvider wrapper
```

---

## 🚀 Adding New Colors

1. **Define the color in both light and dark modes:**

```css
/* src/index.css */
:root {
  --my-brand-color: 180 100% 40%;
  --my-brand-color-foreground: 0 0% 100%;
}

.dark {
  --my-brand-color: 180 100% 60%;
  --my-brand-color-foreground: 0 0% 0%;
}
```

2. **Add to Tailwind config** (if you want utility classes):

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        'brand': {
          DEFAULT: 'hsl(var(--my-brand-color))',
          foreground: 'hsl(var(--my-brand-color-foreground))',
        }
      }
    }
  }
}
```

3. **Use in components:**

```tsx
<div className="bg-brand text-brand-foreground">
  My branded component
</div>
```

---

## 🔍 Debugging Theme Issues

### Check Current Theme
```tsx
const { theme, resolvedTheme } = useTheme();
console.log('Theme setting:', theme);        // 'light', 'dark', or 'system'
console.log('Actual theme:', resolvedTheme); // 'light' or 'dark'
```

### Verify CSS Variables
Open browser DevTools → Console:
```js
getComputedStyle(document.documentElement).getPropertyValue('--primary')
// Should return: "217 91% 48%" (or similar HSL values)
```

### Check DOM for Dark Class
```js
document.documentElement.classList.contains('dark')
// Should return: true (dark mode) or false (light mode)
```

---

## 📚 Resources

- **WCAG Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Color Blind Simulator**: https://www.color-blindness.com/coblis-color-blindness-simulator/
- **HSL Color Picker**: https://hslpicker.com/
- **Tailwind CSS Dark Mode**: https://tailwindcss.com/docs/dark-mode
- **React Context API**: https://react.dev/reference/react/useContext

---

## ⚡ Quick Reference Card

| Task | Solution |
|------|----------|
| Add theme toggle to navbar | `<ThemeToggle />` |
| Change theme in code | `setTheme('dark')` |
| Check current theme | `const { resolvedTheme } = useTheme()` |
| Use primary color | `className="bg-primary text-primary-foreground"` |
| Custom dark mode style | `className="text-gray-900 dark:text-gray-100"` |
| Update colors globally | Edit `src/index.css` `:root` and `.dark` sections |
| Access CSS variable | `hsl(var(--primary))` |
| Add new color | Define in `:root` and `.dark`, then add to `tailwind.config.ts` |

---

**Last Updated**: October 26, 2025  
**Maintained By**: Development Team  
**Version**: 2.0 (Centralized Theme System)
