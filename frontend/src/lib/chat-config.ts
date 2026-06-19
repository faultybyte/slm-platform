export interface ChatConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  model: "tinyllama",
  systemPrompt: "",
  temperature: 0.7,
  topP: 1,
  maxTokens: 512,
};

export const CHAT_CONFIG_LIMITS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  topP: { min: 0, max: 1, step: 0.05 },
  maxTokens: { min: 1, max: 4096, step: 1 },
} as const;