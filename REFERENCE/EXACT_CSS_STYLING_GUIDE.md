# Complete CSS & Styling Guide - VebTask

## Design System Overview

This project uses a sophisticated design system built on **Tailwind CSS** with **semantic color tokens**, **glassmorphism effects**, and **gradient-based UI patterns**.

## Core Files Structure

### 1. Design System Foundation
- `src/index.css` - Global styles, CSS variables, design tokens
- `tailwind.config.ts` - Tailwind configuration with semantic tokens
- Component-level styling patterns

---

## Complete Design Token System

### Base CSS Variables (Dark Theme)
```css
/* From src/index.css */
:root {
  /* Core Colors - Dark Mode Default */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  
  /* Surface Colors */
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --surface: 240 6% 10%;
  --surface-elevated: 240 5% 15%;
  --surface-glass: 240 8% 8% / 0.8;
  
  /* Brand Colors */
  --primary: 250 84% 54%;           /* Electric Blue */
  --primary-foreground: 0 0% 98%;
  --primary-glow: 263 70% 67%;      /* Purple Glow */
  --primary-dark: 250 91% 46%;
  
  /* Accent Colors */
  --secondary: 240 5% 15%;
  --secondary-foreground: 0 0% 98%;
  --accent: 263 70% 67%;            /* Purple Accent */
  --accent-foreground: 0 0% 98%;
  
  /* Status Colors */
  --success: 142 76% 36%;           /* Green */
  --success-foreground: 0 0% 98%;
  --warning: 38 92% 50%;            /* Orange */
  --warning-foreground: 0 0% 9%;
  --error: 0 84% 60%;               /* Red */
  --error-foreground: 0 0% 98%;
  --info: 199 89% 48%;              /* Blue */
  --info-foreground: 0 0% 98%;
  
  /* Neutral Colors */
  --muted: 240 4% 16%;
  --muted-foreground: 240 5% 64%;
  --border: 240 6% 20%;
  --input: 240 6% 20%;
  --ring: 250 84% 54%;
  
  /* Timer-Specific Colors */
  --timer-active: 142 76% 36%;      /* Green when running */
  --timer-paused: 38 92% 50%;       /* Orange when paused */
  --timer-break: 199 89% 48%;       /* Blue for breaks */
  --timer-complete: 263 70% 67%;    /* Purple when done */
  
  /* Project Status Colors */
  --project-billable: 142 76% 36%;
  --project-non-billable: 240 5% 64%;
  --project-emergency: 0 84% 60%;
  
  --radius: 0.75rem;
}
```

### Light Theme Override
```css
.light {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --surface: 240 9% 98%;
  --surface-elevated: 240 9% 95%;
  --surface-glass: 0 0% 100% / 0.8;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
}
```

---

## Gradient System

### Primary Gradients
```css
/* Beautiful gradients used throughout */
--gradient-primary: linear-gradient(135deg, hsl(250 84% 54%) 0%, hsl(263 70% 67%) 100%);
--gradient-secondary: linear-gradient(135deg, hsl(240 5% 15%) 0%, hsl(240 6% 20%) 100%);
--gradient-glass: linear-gradient(135deg, hsl(240 8% 8% / 0.4) 0%, hsl(240 8% 12% / 0.2) 100%);
--gradient-success: linear-gradient(135deg, hsl(142 76% 36%) 0%, hsl(158 64% 52%) 100%);
--gradient-warning: linear-gradient(135deg, hsl(38 92% 50%) 0%, hsl(45 93% 47%) 100%);
--gradient-error: linear-gradient(135deg, hsl(0 84% 60%) 0%, hsl(14 91% 60%) 100%);
```

### Tailwind Gradient Usage
```css
/* In tailwind.config.ts */
backgroundImage: {
  'gradient-primary': 'var(--gradient-primary)',
  'gradient-secondary': 'var(--gradient-secondary)',
  'gradient-glass': 'var(--gradient-glass)',
  'gradient-success': 'var(--gradient-success)',
  'gradient-warning': 'var(--gradient-warning)',
  'gradient-error': 'var(--gradient-error)'
}
```

---

## Shadow & Effects System

### Advanced Shadows
```css
/* From index.css */
--shadow-glass: 0 8px 32px 0 hsl(0 0% 0% / 0.37);
--shadow-glow: 0 0 40px hsl(250 84% 54% / 0.3);
--shadow-elevation: 0 10px 30px -10px hsl(0 0% 0% / 0.3);
```

### Glassmorphism Effects
```css
/* Glass morphism utility classes */
.glass {
  background: var(--gradient-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid hsl(var(--border));
  box-shadow: var(--shadow-glass);
}

.glass-surface {
  background: hsl(var(--surface-glass));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

### Glow Effects
```css
.glow-primary {
  box-shadow: 0 0 20px hsl(var(--primary) / 0.4);
}

.glow-success {
  box-shadow: 0 0 20px hsl(var(--success) / 0.4);
}
```

---

## Animation System

### Custom Keyframes
```css
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px hsl(var(--primary) / 0.4);
  }
  50% {
    box-shadow: 0 0 30px hsl(var(--primary) / 0.6);
  }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Animation Classes
```css
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}
```

### Timer State Animations
```css
.timer-active {
  border-color: hsl(var(--timer-active));
  box-shadow: 0 0 20px hsl(var(--timer-active) / 0.3);
}

.timer-paused {
  border-color: hsl(var(--timer-paused));
  box-shadow: 0 0 20px hsl(var(--timer-paused) / 0.3);
}

.timer-break {
  border-color: hsl(var(--timer-break));
  box-shadow: 0 0 20px hsl(var(--timer-break) / 0.3);
}
```

---

## Typography System

### Gradient Text Effect
```css
.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Font Setup
```css
body {
  @apply bg-background text-foreground font-sans antialiased;
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

---

## Component Styling Patterns

### Cards with Glass Effect
```jsx
<Card className="glass p-6">
  {/* Content */}
</Card>
```

### Gradient Buttons
```jsx
<Button className="bg-gradient-primary hover:shadow-lg">
  Action Button
</Button>
```

### Status-Based Styling
```jsx
// Priority colors
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'text-error';
    case 'medium': return 'text-warning';
    case 'low': return 'text-info';
    default: return 'text-muted-foreground';
  }
};

const getPriorityBg = (priority: string) => {
  switch (priority) {
    case 'high': return 'bg-error/10 border-error/20';
    case 'medium': return 'bg-warning/10 border-warning/20';
    case 'low': return 'bg-info/10 border-info/20';
    default: return 'bg-muted/10 border-border';
  }
};
```

### Icon Containers with Gradients
```jsx
<div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
  <Brain className="h-5 w-5 text-white" />
</div>
```

---

## Scrollbar Styling
```css
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--surface));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted));
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}
```

---

## Layout Patterns

### Main Layout Structure
```jsx
<div className="min-h-screen bg-background">
  <Sidebar />
  <main className="pl-72">
    <div className="p-8">
      {/* Content */}
    </div>
  </main>
</div>
```

### Dashboard Grid
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* Grid items */}
</div>
```

### Header with Gradient Text
```jsx
<div>
  <h1 className="text-3xl font-bold gradient-text">Page Title</h1>
  <p className="text-muted-foreground mt-2">Description</p>
</div>
```

---

## Interactive Elements

### Toggle Groups
```jsx
<ToggleGroup type="single" value={view} onValueChange={setValue}>
  <ToggleGroupItem value="dashboard" aria-label="Dashboard View">
    <LayoutDashboard className="h-4 w-4 mr-2" />
    Dashboard
  </ToggleGroupItem>
</ToggleGroup>
```

### Status Indicators
```jsx
<div className="flex items-center space-x-2 text-sm text-muted-foreground">
  <Save className="h-4 w-4" />
  <span>Status text</span>
</div>
```

---

## Key Design Principles

1. **Semantic Colors**: Always use CSS variables, never hardcoded colors
2. **Glassmorphism**: Heavy use of backdrop blur and transparency
3. **Gradients**: Primary brand colors use vibrant gradients
4. **Glow Effects**: Interactive elements have subtle glow states
5. **Consistent Spacing**: Uses Tailwind's spacing scale
6. **Dark-First**: Designed for dark mode with light mode override
7. **Status Colors**: Consistent color coding for states (success, warning, error, info)

---

## Complete Tailwind Config Extensions

```typescript
// From tailwind.config.ts
extend: {
  colors: {
    // All colors use hsl() wrapper for CSS variables
    primary: {
      DEFAULT: 'hsl(var(--primary))',
      foreground: 'hsl(var(--primary-foreground))',
      glow: 'hsl(var(--primary-glow))',
      dark: 'hsl(var(--primary-dark))'
    },
    // ... full color system
  },
  backgroundImage: {
    'gradient-primary': 'var(--gradient-primary)',
    // ... all gradients
  },
  boxShadow: {
    'glass': 'var(--shadow-glass)',
    'glow': 'var(--shadow-glow)',
    'elevation': 'var(--shadow-elevation)'
  },
  transitionTimingFunction: {
    'smooth': 'var(--transition-smooth)',
    'bounce': 'var(--transition-bounce)'
  }
}
```

This design system creates a modern, professional look with:
- **Rich gradients** for primary elements
- **Glassmorphism effects** for cards and surfaces  
- **Consistent semantic tokens** for maintainability
- **State-aware colors** for different UI states
- **Beautiful animations** for interactions

The key is using CSS variables extensively so colors can be themed and all styling is maintainable through the design token system.