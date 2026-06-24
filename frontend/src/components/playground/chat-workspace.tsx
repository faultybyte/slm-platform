"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageList } from "@/components/playground/message-list";
import { ChatInput } from "@/components/playground/chat-input";
import { PendingFiles } from "@/components/playground/pending-files";
import { ModelSelector } from "@/components/playground/model-selector";
import { PlaygroundEmptyState } from "@/components/playground/playground-empty-state";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { useChat } from "@/lib/hooks/use-chat";

export function ChatWorkspace() {
  const [modelId, setModelId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const searchParams = useSearchParams();

  // Keep conversationId in sync with ?conversation=<id>
  useEffect(() => {
    const param = searchParams.get("conversation");
    const parsed = param ? Number(param) : null;
    if (parsed && parsed !== conversationId) setConversationId(parsed);
  }, [searchParams]);
  const { config } = useChatConfig();
  const queryClient = useQueryClient();
  const conversationsQueryKey = ["conversations"] as const;
  const {
    messages,
    isStreaming,
    isUploadingDoc,
    pendingFiles,
    sendMessage,
    stopStreaming,
    addPendingFile,
    removePendingFile,
  } = useChat({
    modelId,
    conversationId,
    config,
    onConversationReady: (id) => {
      setConversationId(id);
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  const isDisabled = !modelId;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: model selector */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">Model</span>
        <ModelSelector value={modelId} onChange={setModelId} />
      </div>

      {/* Message area */}
      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <PlaygroundEmptyState />
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t px-4 py-3">
        <PendingFiles
          files={pendingFiles}
          isUploading={isUploadingDoc}
          onRemove={removePendingFile}
        />
        <ChatInput
          onSend={sendMessage}
          onStop={stopStreaming}
          onFileDropped={addPendingFile}
          isStreaming={isStreaming}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}
