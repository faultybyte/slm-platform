"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlaygroundEmptyState } from "@/components/playground/playground-empty-state";
import { ChatMessage } from "@/components/playground/chat-message";
import type { PlaygroundMessage } from "@/lib/hooks/use-playground-chat";

export function ChatThread({
  messages,
  isSending,
}: {
  messages: PlaygroundMessage[];
  isSending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isSending]);

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex min-h-full flex-col px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex min-h-[28rem] flex-1 items-center justify-center">
            <PlaygroundEmptyState />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isSending ? (
              <div className="text-xs text-muted-foreground">Streaming response…</div>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}