import type { Preview, Decorator } from "@storybook/nextjs-vite";
import React from "react";

import "../app/globals.css";

// Load Geist fonts for Storybook (next/font doesn't work outside Next.js)
// Using fontsource for consistent font loading
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

// Decorator that sets up theme and fonts
const withThemeAndFonts: Decorator = (Story, context) => {
  const theme = context.globals.theme || "dark";

  React.useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);

    // Set the font CSS variables that globals.css expects
    document.documentElement.style.setProperty(
      "--font-geist-sans",
      '"Geist Variable", system-ui, sans-serif'
    );
    document.documentElement.style.setProperty(
      "--font-geist-mono",
      '"Geist Mono Variable", ui-monospace, monospace'
    );
  }, [theme]);

  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
    layout: "centered",
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [withThemeAndFonts],
};

export default preview;
