/**
 * Mirrors the relevant subset of ChatCompletionRequest from openapi.json.
 * Defaults match the backend schema's declared defaults exactly.
 */
export interface ChatConfig {
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  /** Whether to use SSE streaming mode. Matches the backend `stream` field. */
  stream?: boolean;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  systemPrompt: "",
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 512,
  stream: true,
};

export const CHAT_CONFIG_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  topP: { min: 0, max: 1, step: 0.05 },
  maxTokens: { min: 1, max: 4096, step: 1 },
} as const;
