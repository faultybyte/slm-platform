"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { ConversationMessage } from "@/types/api";
import type { ChatConfig } from "@/lib/chat-config";

export interface ChatMessage extends ConversationMessage {
  // client-only id for stable React keys before server assigns one
  clientId: string;
}

interface UseChatOptions {
  modelId: string | null;
  conversationId: number | null;
  config: ChatConfig;
  onConversationReady: (id: number) => void;
}

export function useChat({
  modelId,
  conversationId,
  config,
  onConversationReady,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prevConversationIdRef = useRef<number | null>(null);

  const uploadDocuments = useCallback(async (convId: number, files: File[]) => {
    setIsUploadingDoc(true);
    try {
      await Promise.all(
        files.map((file) => {
          const form = new FormData();
          form.append("file", file);
          return fetch(`/api/conversations/${convId}/documents`, {
            method: "POST",
            body: form,
          });
        }),
      );
      setPendingFiles([]);
    } catch {
      toast.error("Document upload failed — continuing without context.");
    } finally {
      setIsUploadingDoc(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!modelId || isStreaming) return;

      const userMsg: ChatMessage = {
        clientId: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantPlaceholder: ChatMessage = {
        clientId: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        let activeConvId = conversationId;

        // First message in a new session — create the conversation now
        if (!activeConvId && modelId) {
          try {
            const res = await fetch("/api/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model_id: Number(modelId),
                session_title: text.slice(0, 60) || "New Chat",
              }),
            });
            const conv = await res.json();
            activeConvId = conv.id;
            onConversationReady(conv.id);
          } catch {
            toast.error("Could not start conversation.");
            setIsStreaming(false);
            setMessages((prev) => prev.slice(0, -2)); // remove both optimistic messages
            return;
          }
        }

        if (pendingFiles.length > 0 && activeConvId) {
          await uploadDocuments(activeConvId, pendingFiles);
        }

        const allMessages = [
          ...messages.map(({ role, content }) => ({ role, content })),
          { role: "user" as const, content: text },
        ];

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: modelId,
            messages: allMessages,
            stream: true,
            conversation_id: activeConvId,
            system_prompt: config.systemPrompt || undefined,
            temperature: config.temperature,
            top_p: config.topP,
            max_tokens: config.maxTokens,
          }),
        });

        if (!res.ok || !res.body) {
          let text = "";
          try {
            text = await res.text();
          } catch {}
          toast.error(text || `Stream failed: ${res.status}`);
          // Clean up optimistic assistant placeholder
          setMessages((prev) => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEventName = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            // Track the event type name
            if (line.startsWith("event: ")) {
              currentEventName = line.slice(7).trim();
              continue;
            }

            // Skip keepalive pings (": ping - ...")
            if (line.startsWith(":")) {
              continue;
            }

            if (!line.startsWith("data: ")) {
              // Blank line = end of event block, reset event name
              if (line === "") currentEventName = "";
              continue;
            }
             
            const data = line.slice(6).trim();

            // Process message events and error events
            if (currentEventName === "error") {
              try {
                const errObj = JSON.parse(data);
                const detail = errObj.detail ?? errObj.message ?? data;
                toast.error(String(detail));
              } catch {
                toast.error(data);
              }
              // stop streaming on backend error
              setIsStreaming(false);
              abortRef.current?.abort();
              return;
            }

            if (currentEventName !== "message") continue;

            try {
              const chunk = JSON.parse(data);

              // Real token
              const token = chunk.token ?? "";
              if (token) {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") {
                    next[next.length - 1] = {
                      ...last,
                      content: last.content + token,
                    };
                  }
                  return next;
                });
              }

            } catch {
              // malformed chunk, skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Something went wrong. Please try again.");
          // Remove the empty assistant placeholder on error
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      modelId,
      isStreaming,
      messages,
      conversationId,
      config,
      pendingFiles,
      uploadDocuments,
      onConversationReady,
    ],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      prevConversationIdRef.current = null;
      return;
    }

    // Only abort if we're switching to a different conversation (not on initial load)
    // prevConversationIdRef tracks the last conversation we loaded/streamed to
    if (prevConversationIdRef.current !== null && prevConversationIdRef.current !== conversationId) {
      abortRef.current?.abort();
      setIsStreaming(false);
    }
    prevConversationIdRef.current = conversationId;

    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let txt = "";
          try {
            txt = await res.text();
          } catch {}
          toast.error(txt || `Failed to load messages: ${res.status}`);
          return;
        }

        const msgs: ConversationMessage[] = await res.json();
        setMessages(msgs.map((m) => ({ ...m, clientId: crypto.randomUUID() })));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Failed to load conversation messages.");
        }
      }
    })();

    return () => ctrl.abort();
  }, [conversationId]);

  const addPendingFile = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file]);
  }, []);

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    messages,
    isStreaming,
    isUploadingDoc,
    pendingFiles,
    sendMessage,
    stopStreaming,
    addPendingFile,
    removePendingFile,
  };
}
