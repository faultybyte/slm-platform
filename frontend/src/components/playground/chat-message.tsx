"use client";

import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlaygroundMessage } from "@/lib/hooks/use-playground-chat";

export function ChatMessage({ message }: { message: PlaygroundMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="mt-1 h-8 w-8">
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm",
          isUser ? "border-primary/20 bg-primary text-primary-foreground" : "bg-card"
        )}
      >
        <div className="flex items-center gap-2">
          <Badge variant={isUser ? "secondary" : "outline"} className="px-2 py-0 text-[10px] uppercase tracking-wide">
            {isUser ? "You" : "Assistant"}
          </Badge>
          {message.isStreaming ? (
            <span className="text-xs text-muted-foreground">typing...</span>
          ) : null}
        </div>

        <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {message.content || (message.isStreaming ? "Generating…" : "")}
          {message.isStreaming ? <span className="ml-1 inline-block animate-pulse">▍</span> : null}
        </div>
      </div>

      {isUser && (
        <Avatar className="mt-1 h-8 w-8">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}