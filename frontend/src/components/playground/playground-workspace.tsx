"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useChatConfig } from "@/components/playground/chat-config-context";
import { ChatComposer } from "@/components/playground/chat-composer";
import { ChatThread } from "@/components/playground/chat-thread";
import { usePlaygroundChat } from "@/lib/hooks/use-playground-chat";

export function PlaygroundWorkspace() {
  const { config } = useChatConfig();
  const {
    messages,
    input,
    setInput,
    pendingFiles,
    setPendingFiles,
    isSending,
    error,
    sendMessage,
    clearConversation,
  } = usePlaygroundChat();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <div>
          <p className="text-sm font-semibold">Playground</p>
          <p className="text-xs text-muted-foreground">Multi-turn chat workspace.</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">Model: {config.model || "tinyllama"}</Badge>
          <Button variant="outline" size="sm" onClick={clearConversation}>
            Clear chat
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <ChatThread messages={messages} isSending={isSending} />
        </div>

        {error ? (
          <div className="border-t px-5 py-3 text-sm text-destructive">{error}</div>
        ) : (
          <Separator />
        )}

        <ChatComposer
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          isSending={isSending}
          pendingFiles={pendingFiles}
          setPendingFiles={setPendingFiles}
        />
      </div>
    </div>
  );
}