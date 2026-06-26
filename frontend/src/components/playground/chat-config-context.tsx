"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ChatConfig, DEFAULT_CHAT_CONFIG } from "@/lib/chat-config";

// Handlers that ChatWorkspace registers once it has an active conversationId
export interface RagHandlers {
  /** Upload a file immediately against the current (or next) conversation. */
  uploadFile: (file: File) => Promise<void>;
  /** Delete all document vectors for the current conversation. */
  clearDocuments: () => Promise<void>;
}

interface ChatConfigContextValue {
  // Generation settings
  config: ChatConfig;
  setConfig: (config: ChatConfig) => void;
  updateConfig: (patch: Partial<ChatConfig>) => void;

  // Sidebar
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // RAG — read by RightSidebar
  pendingFiles: File[];
  isUploadingDoc: boolean;
  hasUploadedDocs: boolean;
  onFileSelected: (file: File) => void;
  onClearDocuments: () => void;

  // Called by ChatWorkspace to hand off upload / clear implementations
  registerRagHandlers: (handlers: RagHandlers | null) => void;
  // Called by ChatWorkspace when it loads a historical conversation
  setHasUploadedDocs: (v: boolean) => void;
}

const ChatConfigContext = createContext<ChatConfigContextValue | null>(null);

export function ChatConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [hasUploadedDocs, setHasUploadedDocs] = useState(false);

  // Points to ChatWorkspace's current upload/clear implementations
  const ragHandlersRef = useRef<RagHandlers | null>(null);

  const registerRagHandlers = useCallback((handlers: RagHandlers | null) => {
    ragHandlersRef.current = handlers;
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<ChatConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    [],
  );

  const onFileSelected = useCallback(async (file: File) => {
    setPendingFiles((p) => [...p, file]);
    setIsUploadingDoc(true);
    try {
      if (ragHandlersRef.current) {
        await ragHandlersRef.current.uploadFile(file);
        setHasUploadedDocs(true);
      }
      // If no handlers yet (no conversation created), the file stays in pendingFiles
      // and ChatWorkspace will upload it when a conversation is ready.
    } catch {
      toast.error("Document upload failed.");
      setPendingFiles((p) => p.filter((f) => f !== file));
    } finally {
      setIsUploadingDoc(false);
    }
  }, []);

  const onClearDocuments = useCallback(async () => {
    try {
      await ragHandlersRef.current?.clearDocuments();
    } catch {
      toast.error("Failed to clear documents.");
    }
    setPendingFiles([]);
    setHasUploadedDocs(false);
  }, []);

  return (
    <ChatConfigContext.Provider
      value={{
        config,
        setConfig,
        updateConfig,
        isSidebarOpen,
        setSidebarOpen,
        pendingFiles,
        isUploadingDoc,
        hasUploadedDocs,
        onFileSelected,
        onClearDocuments,
        registerRagHandlers,
        setHasUploadedDocs,
      }}
    >
      {children}
    </ChatConfigContext.Provider>
  );
}

export function useChatConfig() {
  const ctx = useContext(ChatConfigContext);
  if (!ctx) throw new Error("useChatConfig must be used within a ChatConfigProvider");
  return ctx;
}