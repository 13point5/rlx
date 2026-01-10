# UI Component Guidelines

This document describes how to create UI components following the shadcn/ui pattern used in this project.

## File Structure

```
components/
├── ui/              # Primitive components (Button, Card, Input, etc.)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── [feature].tsx    # Composed/feature components (ProjectCard, RunList, etc.)
└── ...
```

- **`components/ui/`**: Low-level, reusable primitives. These are style-focused and don't contain business logic.
- **`components/`**: Higher-level components that compose primitives and may include business logic.

## Creating a Primitive Component (`components/ui/`)

### 1. Basic Structure

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function ComponentName({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component-name"
      className={cn("base-styles-here", className)}
      {...props}
    />
  );
}

export { ComponentName };
```

### 2. With Variants (using `cva`)

Use `class-variance-authority` for components with multiple variants:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border bg-background",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function ComponentName({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof componentVariants>) {
  return (
    <div
      data-slot="component-name"
      data-variant={variant}
      data-size={size}
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { ComponentName, componentVariants };
```

### 3. Key Patterns

#### Always use `cn()` for className merging

```tsx
import { cn } from "@/lib/utils";

// Allows consumers to override/extend styles
className={cn("default-styles", className)}
```

#### Use `data-slot` for CSS targeting

```tsx
<div data-slot="card-header" ... />
```

This enables parent components to style children:
```css
[data-slot="card"] [data-slot="card-header"] { ... }
```

#### Accept `className` prop for customization

Always spread `className` to allow consumers to add custom styles.

#### Use `React.ComponentProps<"element">` for type inheritance

```tsx
// For a div-based component
React.ComponentProps<"div">

// For a button-based component
React.ComponentProps<"button">

// For extending with custom props
React.ComponentProps<"button"> & { customProp: string }
```

#### Use `Slot` for polymorphic components

```tsx
import { Slot } from "@radix-ui/react-slot";

function Button({ asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return <Comp {...props} />;
}

// Usage: renders as anchor but with Button styles
<Button asChild>
  <a href="/link">Click me</a>
</Button>
```

## Creating a Composed Component (`components/`)

Composed components use primitives and may include business logic:

```tsx
"use client"; // If using React hooks

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProjectCardProps {
  name: string;
  description?: string;
  onSelect?: () => void;
}

export function ProjectCard({ name, description, onSelect }: ProjectCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>
        {description && <p className="text-muted-foreground">{description}</p>}
        <Button onClick={onSelect}>View Project</Button>
      </CardContent>
    </Card>
  );
}
```

## Adding shadcn Components

Use the shadcn CLI to add pre-built components:

```bash
pnpm dlx shadcn@latest add [component-name]
```

Examples:
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add sidebar
pnpm dlx shadcn@latest add dialog
```

## Styling Guidelines

### Use Design Tokens

Always use CSS variables defined in `globals.css`:

```tsx
// Good
className="bg-background text-foreground border-border"
className="text-muted-foreground"
className="bg-primary text-primary-foreground"

// Avoid hardcoded colors
className="bg-white text-black" // Bad
```

### Responsive Design

Use Tailwind breakpoints consistently:

```tsx
// Mobile-first approach
className="w-full md:w-1/2 lg:w-1/3"
className="hidden md:block"        // Hide on mobile
className="block md:hidden"        // Show only on mobile
```

### Dark Mode

Use the `dark:` variant for dark mode styles:

```tsx
className="bg-white dark:bg-zinc-900"
```

Most design tokens already handle dark mode automatically.

## Naming Conventions

- **Files**: kebab-case (`project-card.tsx`)
- **Components**: PascalCase (`ProjectCard`)
- **Variants**: camelCase (`buttonVariants`)
- **CSS classes**: Use Tailwind utilities

## Checklist for New Components

- [ ] Uses `cn()` for className merging
- [ ] Accepts and spreads `className` prop
- [ ] Uses `data-slot` attribute
- [ ] Uses design tokens (not hardcoded colors)
- [ ] Exports component (and variants if applicable)
- [ ] Has proper TypeScript types
- [ ] Is responsive (works on mobile and desktop)
