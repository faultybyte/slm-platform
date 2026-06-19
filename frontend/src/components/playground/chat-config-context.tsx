"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { ChatConfig, DEFAULT_CHAT_CONFIG } from "@/lib/chat-config";

type ChatConfigContextValue = {
  config: ChatConfig;
  setConfig: React.Dispatch<React.SetStateAction<ChatConfig>>;
  updateConfig: (patch: Partial<ChatConfig>) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const ChatConfigContext = createContext<ChatConfigContextValue | null>(null);

export function ChatConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const value = useMemo<ChatConfigContextValue>(
    () => ({
      config,
      setConfig,
      updateConfig: (patch) => setConfig((prev) => ({ ...prev, ...patch })),
      isSidebarOpen,
      setSidebarOpen,
    }),
    [config, isSidebarOpen]
  );

  return <ChatConfigContext.Provider value={value}>{children}</ChatConfigContext.Provider>;
}

export function useChatConfig() {
  const ctx = useContext(ChatConfigContext);
  if (!ctx) {
    throw new Error("useChatConfig must be used within ChatConfigProvider");
  }
  return ctx;
}