"use client";

import { ChatConfigProvider } from "@/components/playground/chat-config-context";
import { RightSidebar } from "@/components/playground/right-sidebar";
import { RightSidebarReopenButton } from "@/components/playground/right-sidebar-reopen-button";

export function PlaygroundShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatConfigProvider>
      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <RightSidebarReopenButton />
        <RightSidebar />
      </div>
    </ChatConfigProvider>
  );
}