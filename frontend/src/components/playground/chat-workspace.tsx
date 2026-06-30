"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "@/components/playground/message-list";
import { ChatInput } from "@/components/playground/chat-input";
import { ModelSelector } from "@/components/playground/model-selector";
import { PlaygroundEmptyState } from "@/components/playground/playground-empty-state";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { useChat } from "@/lib/hooks/use-chat";
import { useModels } from "@/lib/hooks/use-models";
import { useSettings } from "@/lib/hooks/use-settings";

const SELECTED_MODEL_KEY = "forge_selected_model_id";

export function ChatWorkspace() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { data: models } = useModels();

  useEffect(() => {
    const param = searchParams.get("conversation");
    const parsed = param ? Number(param) : null;
    // Previously this only handled the "switch to a new conversation" case.
    // When the param is removed entirely (e.g. after deleting the active
    // conversation and navigating back to /dashboard), conversationId was
    // never reset, so the deleted conversation's messages kept rendering
    // in the mainbar until a hard refresh remounted the component.
    if (parsed !== conversationId) setConversationId(parsed);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: settings } = useSettings();

  const normalizeModelSlug = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-");

  useEffect(() => {
    if (!models || models.length === 0) return;
    if (modelId !== null) return;

    // 1. Use the default_model from user settings (matched by display_name slug)
    if (settings?.default_model) {
      const slug = normalizeModelSlug(settings.default_model);
      const bySlug = models.find(
        (m) => normalizeModelSlug(m.display_name) === slug
      );
      if (bySlug) {
        setModelId(String(bySlug.id));
        return;
      }
    }

    // 2. Honour last manually chosen model
    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && models.some((m) => String(m.id) === saved)) {
      setModelId(saved);
      return;
    }

    // 3. Fallback: first base model
    const def = models.find((m) => m.is_base_model);
    if (def) setModelId(String(def.id));
  }, [models, settings, modelId]);

  const handleModelChange = (id: string | null) => {
    setModelId(id);
    if (id) localStorage.setItem(SELECTED_MODEL_KEY, id);
    else localStorage.removeItem(SELECTED_MODEL_KEY);
  };

  const {
    config,
    ragConfig,
    pendingFiles,
    onFileSelected,
    registerRagHandlers,
    setUploadedFileNames,
    setHasUploadedDocs,
    clearPendingFiles,
  } = useChatConfig();

  const selectedModel = modelId ? models?.find((m) => String(m.id) === modelId) : undefined;
  const queryClient = useQueryClient();

  const handleDocumentsLoaded = useCallback(
    (filenames: string[], hasDocuments: boolean) => {
      setUploadedFileNames(filenames);
      setHasUploadedDocs(hasDocuments);
    },
    [setUploadedFileNames, setHasUploadedDocs],
  );

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    uploadFile,
    clearDocuments,
  } = useChat({
    modelId,
    modelName: selectedModel?.display_name ?? null,
    conversationId,
    config,
    ragConfig,
    onConversationReady: (id) => {
      setConversationId(id);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onDocumentsLoaded: handleDocumentsLoaded,
  });

  // Register upload/clear handlers with context whenever conversationId changes
  useEffect(() => {
    if (!conversationId) {
      registerRagHandlers(null);
      return;
    }

    registerRagHandlers({
      uploadFile: async (file: File, chunkSize: number, chunkOverlap: number) => {
        await uploadFile(conversationId, file, chunkSize, chunkOverlap);
        const res = await fetch(`/api/conversations/${conversationId}/documents`);
        if (res.ok) {
          const data = await res.json();
          setUploadedFileNames(data.filenames ?? []);
          setHasUploadedDocs(data.has_documents ?? false);
        }
      },
      clearDocuments: async () => {
        await clearDocuments(conversationId);
      },
    });

    return () => registerRagHandlers(null);
  }, [conversationId, uploadFile, clearDocuments, registerRagHandlers, setUploadedFileNames, setHasUploadedDocs]);

  const handleSend = useCallback(
    (text: string) => {
      // Clear queued files immediately so they aren't re-sent on next message
      clearPendingFiles();
      sendMessage(text, pendingFiles);
    },
    [sendMessage, pendingFiles, clearPendingFiles],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">Model</span>
        <ModelSelector value={modelId || ""} onChange={handleModelChange} />
      </div>

      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <PlaygroundEmptyState />
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </ScrollArea>

      <div className="border-t px-4 py-3">
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          onFileDropped={onFileSelected}
          isStreaming={isStreaming}
          isDisabled={!modelId}
        />
      </div>
    </div>
  );
}