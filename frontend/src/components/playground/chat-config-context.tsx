"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  ChatConfig,
  DEFAULT_CHAT_CONFIG,
  RagConfig,
  DEFAULT_RAG_CONFIG,
  RAG_STORAGE_KEY,
} from "@/lib/chat-config";

const CONFIG_STORAGE_KEY = "forge_chat_config";

function loadPersistedConfig(): ChatConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return { ...DEFAULT_CHAT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

function loadPersistedRagConfig(): RagConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RAG_STORAGE_KEY);
    if (!raw) return null;
    return { ...DEFAULT_RAG_CONFIG, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export interface RagHandlers {
  uploadFile: (file: File, chunkSize: number, chunkOverlap: number) => Promise<void>;
  clearDocuments: () => Promise<void>;
}

interface ChatConfigContextValue {
  config: ChatConfig;
  setConfig: (config: ChatConfig) => void;
  updateConfig: (patch: Partial<ChatConfig>) => void;

  ragConfig: RagConfig;
  updateRagConfig: (patch: Partial<RagConfig>) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // RAG — read by RightSidebar
  uploadedFileNames: string[];
  pendingFiles: File[];
  isUploadingDoc: boolean;
  hasUploadedDocs: boolean;
  onFileSelected: (file: File) => void;
  onClearDocuments: () => void;
  setUploadedFileNames: (names: string[]) => void;
  setHasUploadedDocs: (v: boolean) => void;
  clearPendingFiles: () => void;

  registerRagHandlers: (handlers: RagHandlers | null) => void;
}

const ChatConfigContext = createContext<ChatConfigContextValue | null>(null);

export function ChatConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [ragConfig, setRagConfigState] = useState<RagConfig>(DEFAULT_RAG_CONFIG);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Hydrate from localStorage after mount only. Reading localStorage inside
  // the useState initializer ran on the client's *first* (hydration) render
  // too, so it could return a different value than the server-rendered
  // default — causing a hydration mismatch (e.g. "Chunk size: 1000" on the
  // client vs "500" from the server). Deferring to useEffect guarantees the
  // first paint matches SSR exactly; the persisted value then applies a
  // tick later, after hydration is done.
  useEffect(() => {
    const persistedConfig = loadPersistedConfig();
    if (persistedConfig) setConfigState(persistedConfig);

    const persistedRagConfig = loadPersistedRagConfig();
    if (persistedRagConfig) setRagConfigState(persistedRagConfig);
  }, []);

  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [hasUploadedDocs, setHasUploadedDocs] = useState(false);

  const ragHandlersRef = useRef<RagHandlers | null>(null);
  // Ref so onFileSelected always reads the latest ragConfig without re-creating the callback
  const ragConfigRef = useRef<RagConfig>(ragConfig);
  useEffect(() => {
    ragConfigRef.current = ragConfig;
  }, [ragConfig]);

  // ── Chat config ────────────────────────────────────────────────────────────
  const setConfig = useCallback((c: ChatConfig) => {
    setConfigState(c);
    try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(c)); } catch {}
  }, []);

  const updateConfig = useCallback((patch: Partial<ChatConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── RAG config ─────────────────────────────────────────────────────────────
  const updateRagConfig = useCallback((patch: Partial<RagConfig>) => {
    setRagConfigState((prev) => {
      const next = { ...prev, ...patch };
      ragConfigRef.current = next;
      try { localStorage.setItem(RAG_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearPendingFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  // ── RAG handlers ───────────────────────────────────────────────────────────
  const registerRagHandlers = useCallback((handlers: RagHandlers | null) => {
    ragHandlersRef.current = handlers;
  }, []);

  const onFileSelected = useCallback(async (file: File) => {
    const { chunkSize, chunkOverlap } = ragConfigRef.current;

    if (ragHandlersRef.current) {
      setPendingFiles((p) => [...p, file]);
      setIsUploadingDoc(true);
      try {
        await ragHandlersRef.current.uploadFile(file, chunkSize, chunkOverlap);
        setUploadedFileNames((p) => [...p, file.name]);
        setHasUploadedDocs(true);
      } catch {
        toast.error("Document upload failed.");
        setPendingFiles((p) => p.filter((f) => f !== file));
      } finally {
        setIsUploadingDoc(false);
      }
    } else {
      // No conversation yet — queue; ChatWorkspace flushes on first send
      setPendingFiles((p) => [...p, file]);
    }
  }, []);

  const onClearDocuments = useCallback(async () => {
    try {
      await ragHandlersRef.current?.clearDocuments();
    } catch {
      toast.error("Failed to clear documents.");
    }
    setPendingFiles([]);
    setUploadedFileNames([]);
    setHasUploadedDocs(false);
  }, []);

  return (
    <ChatConfigContext.Provider
      value={{
        config,
        setConfig,
        updateConfig,
        ragConfig,
        updateRagConfig,
        isSidebarOpen,
        setSidebarOpen,
        uploadedFileNames,
        pendingFiles,
        isUploadingDoc,
        hasUploadedDocs,
        onFileSelected,
        onClearDocuments,
        setUploadedFileNames,
        setHasUploadedDocs,
        clearPendingFiles,
        registerRagHandlers,
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