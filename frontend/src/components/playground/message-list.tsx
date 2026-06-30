"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hooks/use-chat";
import { MarkdownRenderer } from "@/components/markdown-renderer";

function MessageBubble({
  message,
  isLast,
  isStreaming,
}: {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const showCursor = isLast && !isUser && isStreaming;

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-medium",
          isUser
            ? "bg-brand text-brand-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-3 group",
          isUser
            ? "bg-brand text-brand-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
        {showCursor && (
          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-current align-middle" />
        )}
        {message.role === "assistant" && message.modelName && (
          <div className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[11px] text-muted-foreground">
              Model: {message.modelName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new tokens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col py-4">
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.clientId}
          message={msg}
          isLast={i === messages.length - 1}
          isStreaming={isStreaming}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
