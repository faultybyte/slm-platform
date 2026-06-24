import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

import AppThemeProvider from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SLM Platform",
  description: "Self-hosted SLM training and evaluation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
   <html
  lang="en"
  className={cn("h-full antialiased", "font-sans", geist.variable)}
  suppressHydrationWarning
>
  <body className="min-h-full flex flex-col font-sans">

    <AppThemeProvider>

      <QueryProvider>

        <TooltipProvider delayDuration={200}>

          {children}

          <Toaster
            richColors
            position="top-right"
          />

        </TooltipProvider>

      </QueryProvider>

    </AppThemeProvider>

  </body>
</html>
  );
}