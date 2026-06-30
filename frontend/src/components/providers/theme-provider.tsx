"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface Props {
  children: React.ReactNode;
}

// next-themes renders an inline <script> (via React.createElement) to set
// the theme class on <html> before first paint, avoiding a flash of the
// wrong theme. React 19 warns whenever a <script> tag shows up in normal
// component render output, since React itself won't execute it — but
// next-themes doesn't rely on React to execute it, so the script still
// works correctly and the warning is a false positive. There's no patched
// next-themes release yet (last published before React 19's stricter
// warning shipped), so this filters only that specific message in dev.
// See: https://github.com/shadcn-ui/ui/issues/10104
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering")
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

export default function AppThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange
      storageKey="forge-theme"
    >
      {children}
    </NextThemesProvider>
  );
}