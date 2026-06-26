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

const SELECTED_MODEL_KEY = "forge_selected_model_id";

export function ChatWorkspace() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { data: models } = useModels();

  useEffect(() => {
    const param = searchParams.get("conversation");
    const parsed = param ? Number(param) : null;
    if (parsed && parsed !== conversationId) setConversationId(parsed);
  }, [searchParams]);

  useEffect(() => {
    if (!models || models.length === 0) return;
    if (modelId !== null) return;

    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && models.some((m) => String(m.id) === saved)) {
      setModelId(saved);
      return;
    }

    const llamaModel = models.find(
      (m) => m.is_base_model && m.base_model_key?.toLowerCase().includes("llama"),
    );
    const fallback = models.find((m) => m.is_base_model);
    const def = llamaModel ?? fallback;
    if (def) setModelId(String(def.id));
  }, [models]);

  const handleModelChange = (id: string | null) => {
    setModelId(id);
    if (id) localStorage.setItem(SELECTED_MODEL_KEY, id);
    else localStorage.removeItem(SELECTED_MODEL_KEY);
  };

  const {
    config,
    pendingFiles,
    registerRagHandlers,
    setHasUploadedDocs,
  } = useChatConfig();

  const queryClient = useQueryClient();
  const conversationsQueryKey = ["conversations"] as const;

  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    uploadFile,
    clearDocuments,
  } = useChat({
    modelId,
    conversationId,
    config,
    onConversationReady: (id) => {
      setConversationId(id);
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  // Register RAG handlers with the context whenever conversationId changes so
  // the sidebar's upload/clear buttons act on the correct conversation.
  useEffect(() => {
    registerRagHandlers({
      uploadFile: async (file: File) => {
        if (!conversationId) return; // not yet created; will be uploaded on first send
        await uploadFile(conversationId, file);
        setHasUploadedDocs(true);
      },
      clearDocuments: async () => {
        if (!conversationId) return;
        await clearDocuments(conversationId);
        setHasUploadedDocs(false);
      },
    });

    // Check RAG status when loading an existing conversation
    if (conversationId) {
      fetch(`/api/conversations/${conversationId}/documents`)
        .then((r) => r.json())
        .then((d) => setHasUploadedDocs(Boolean(d?.has_documents)))
        .catch(() => {});
    } else {
      setHasUploadedDocs(false);
    }

    return () => {
      registerRagHandlers(null);
    };
  }, [conversationId, uploadFile, clearDocuments, registerRagHandlers, setHasUploadedDocs]);

  // Wrap sendMessage to pass any queued files so they upload with the first message
  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text, pendingFiles);
    },
    [sendMessage, pendingFiles],
  );

  // onFileDropped still works for drag-and-drop directly onto the chat input;
  // it goes through the context's onFileSelected which handles the upload.
  const { onFileSelected } = useChatConfig();

  const isDisabled = !modelId;

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
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}