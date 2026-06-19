"use client";

import { PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatConfig } from "@/components/playground/chat-config-context";

export function RightSidebarReopenButton() {
  const { isSidebarOpen, setSidebarOpen } = useChatConfig();

  if (isSidebarOpen) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="absolute right-4 top-4 z-20 h-9 w-9"
      onClick={() => setSidebarOpen(true)}
      aria-label="Open settings"
    >
      <PanelRightOpen className="h-4 w-4" />
    </Button>
  );
}