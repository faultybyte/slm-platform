"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatConfig } from "@/components/playground/chat-config-context";

export type PlaygroundRole = "user" | "assistant";

export interface PlaygroundMessage {
  id: string;
  role: PlaygroundRole;
  content: string;
  isStreaming?: boolean;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractTokenFromSseBlock(block: string) {
  const dataLine = block
    .split("\n")
    .find((line) => line.trim().startsWith("data:"));

  if (!dataLine) return "";

  const payload = dataLine.replace(/^data:\s*/, "").trim();

  if (!payload || payload === "[DONE]") return "";

  try {
    const parsed = JSON.parse(payload);
    return typeof parsed?.token === "string" ? parsed.token : "";
  } catch {
    return "";
  }
}

export function usePlaygroundChat() {
  const { config } = useChatConfig();

  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setInput("");
    setPendingFiles([]);
    setError(null);
    setConversationId(null);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const hasFiles = pendingFiles.length > 0;

    if (!text && !hasFiles) return;
    if (isSending) return;

    setError(null);
    setIsSending(true);

    try {
      let activeConversationId = conversationId ?? 1;

      if (!conversationId) {
        setConversationId(activeConversationId);
      }

      if (hasFiles) {
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append("file", file);

          const uploadRes = await fetch(
            `/api/upload?conversationId=${activeConversationId}`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadRes.ok) {
            let message = "File upload failed";
            try {
              const body = await uploadRes.json();
              message = body?.message ?? message;
            } catch {
              // keep fallback
            }
            throw new Error(message);
          }
        }

        setPendingFiles([]);
      }

      const userMessage: PlaygroundMessage = {
        id: createId(),
        role: "user",
        content: text || "Please review the uploaded documents.",
      };

      const assistantId = createId();

      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          isStreaming: true,
        },
      ]);

      setInput("");

      const payload = {
        model: config.model,
        messages: [...messagesRef.current, userMessage].map(({ role, content }) => ({
          role,
          content,
        })),
        system_prompt: config.systemPrompt || null,
        temperature: config.temperature,
        top_p: config.topP,
        max_tokens: config.maxTokens,
        stream: true,
        conversation_id: activeConversationId,
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = "Chat request failed";
        try {
          const body = await res.json();
          message = body?.message ?? body?.detail ?? message;
        } catch {
          // keep fallback
        }
        throw new Error(message);
      }

      if (!res.body) {
        throw new Error("No stream returned");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let accumulatedText = "";

      const appendToken = (token: string) => {
        if (!token) return;

        accumulatedText += token;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: accumulatedText,
                }
              : msg
          )
        );
      };

      const consumeBuffer = (value: string) => {
        const normalized = value.replace(/\r\n/g, "\n");
        const blocks = normalized.split(/\n\n+/);

        for (const block of blocks) {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) continue;

          const token = extractTokenFromSseBlock(trimmedBlock);
          if (token) appendToken(token);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
          const block = buffer.slice(0, boundaryIndex).trim();
          buffer = buffer.slice(boundaryIndex + 2);

          if (block) {
            const token = extractTokenFromSseBlock(block);
            if (token) appendToken(token);
          }

          boundaryIndex = buffer.indexOf("\n\n");
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        consumeBuffer(buffer);
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                isStreaming: false,
                content: msg.content || "No response returned.",
              }
            : msg
        )
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";

      setError(message);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming
            ? {
                ...msg,
                content: message,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  }, [
    config.model,
    config.systemPrompt,
    config.temperature,
    config.topP,
    config.maxTokens,
    conversationId,
    input,
    isSending,
    pendingFiles,
  ]);

  return {
    messages,
    input,
    setInput,
    pendingFiles,
    setPendingFiles,
    isSending,
    error,
    sendMessage,
    clearConversation,
  };
}