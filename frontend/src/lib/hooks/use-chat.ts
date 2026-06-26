"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { ConversationMessage } from "@/types/api";
import type { ChatConfig } from "@/lib/chat-config";

export interface ChatMessage extends ConversationMessage {
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
  const abortRef = useRef<AbortController | null>(null);
  const prevConversationIdRef = useRef<number | null>(null);
  const conversationIdRef = useRef<number | null>(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // ── RAG file upload helpers (called by ChatWorkspace) ──────────────────────

  const uploadFile = useCallback(async (convId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/conversations/${convId}/documents`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? `Upload failed: ${res.status}`);
    }
  }, []);

  const uploadFiles = useCallback(
    async (convId: number, files: File[]) => {
      await Promise.all(files.map((f) => uploadFile(convId, f)));
    },
    [uploadFile],
  );

  const clearDocuments = useCallback(async (convId: number) => {
    await fetch(`/api/conversations/${convId}/documents`, { method: "DELETE" });
  }, []);

  // ── Send message ───────────────────────────────────────────────────────────

  /**
   * pendingFilesRef: ChatWorkspace passes any queued files here before calling
   * sendMessage so they get uploaded right after conversation creation.
   */
  const pendingFilesRef = useRef<File[]>([]);

  const sendMessage = useCallback(
    async (text: string, pendingFiles: File[] = []) => {
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
        let activeConvId = conversationIdRef.current;

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
            conversationIdRef.current = conv.id;
            onConversationReady(conv.id);
          } catch {
            toast.error("Could not start conversation.");
            setIsStreaming(false);
            setMessages((prev) => prev.slice(0, -2));
            return;
          }
        }

        // Upload any queued documents now that we have a conversation ID
        if (pendingFiles.length > 0 && activeConvId) {
          try {
            await uploadFiles(activeConvId, pendingFiles);
          } catch {
            toast.error("Document upload failed — continuing without context.");
          }
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
          let errText = "";
          try { errText = await res.text(); } catch {}
          toast.error(errText || `Stream failed: ${res.status}`);
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
            if (line.startsWith("event: ")) {
              currentEventName = line.slice(7).trim();
              continue;
            }
            if (line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) {
              if (line === "") currentEventName = "";
              continue;
            }

            const data = line.slice(6).trim();

            if (currentEventName === "error") {
              try {
                const errObj = JSON.parse(data);
                toast.error(String(errObj.detail ?? errObj.message ?? data));
              } catch { toast.error(data); }
              setIsStreaming(false);
              abortRef.current?.abort();
              return;
            }

            if (currentEventName !== "message") continue;

            try {
              const chunk = JSON.parse(data);
              const token = chunk.token ?? "";
              if (token) {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") {
                    next[next.length - 1] = { ...last, content: last.content + token };
                  }
                  return next;
                });
              }
            } catch { /* malformed chunk */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Something went wrong. Please try again.");
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [modelId, isStreaming, messages, config, uploadFiles, onConversationReady],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Load messages when conversation changes ────────────────────────────────

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      prevConversationIdRef.current = null;
      return;
    }

    const isNewlyCreated = prevConversationIdRef.current === null && isStreaming;

    if (prevConversationIdRef.current !== null && prevConversationIdRef.current !== conversationId) {
      abortRef.current?.abort();
      setIsStreaming(false);
    }
    prevConversationIdRef.current = conversationId;

    if (isNewlyCreated) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          toast.error(txt || `Failed to load messages: ${res.status}`);
          return;
        }
        const msgs: ConversationMessage[] = await res.json();
        setMessages(msgs.map((m) => ({ ...m, clientId: crypto.randomUUID() })));
      } catch (err) {
        if ((err as Error).name !== "AbortError")
          toast.error("Failed to load conversation messages.");
      }
    })();

    return () => ctrl.abort();
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    uploadFile,
    uploadFiles,
    clearDocuments,
  };
}