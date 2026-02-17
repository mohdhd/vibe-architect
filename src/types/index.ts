export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  phase: ConversationPhase;
  messages: Message[];
  sandboxCode: string | null;
  specDocs: Partial<Record<ConversationPhase, string>>;
  createdAt: number;
  updatedAt: number;
}

export type ConversationPhase = "vision" | "design" | "stack" | "export";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}



// LLM providers for text chat and the ASR+TTS pipeline
export type LLMProvider = "openai" | "gemini" | "anthropic" | "mistral" | "glm";

// Specific models
export type LLMModel =
  | "gpt-5.2-high"
  | "gpt-5.2-medium"
  | "gpt-5.2-xhigh"
  | "gemini-3-pro"
  | "gemini-3-flash"
  | "claude-opus-4.6"
  | "claude-sonnet-4.5"
  | "mistral-medium-3.1"
  | "mistral-small-3.2"
  | "glm-4.6"
  | "glm-4.7"
  | "glm-4.6v"
  | "glm-4.7-flash"
  | "glm-5";

export interface LLMModelConfig {
  id: LLMModel;
  name: string;
  provider: LLMProvider;
  maxTokens: number;
  /** The actual model ID sent to the API (if different from `id`) */
  apiModel?: string;
  /** Reasoning effort level for OpenAI reasoning models */
  reasoningEffort?: "medium" | "high" | "xhigh";
}

export const LLM_MODELS: LLMModelConfig[] = [
  {
    id: "gpt-5.2-high",
    name: "GPT-5.2 (High)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "high",
  },
  {
    id: "gpt-5.2-medium",
    name: "GPT-5.2 (Medium)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "medium",
  },
  {
    id: "gpt-5.2-xhigh",
    name: "GPT-5.2 (XHigh)",
    provider: "openai",
    maxTokens: 128000,
    apiModel: "gpt-5.2",
    reasoningEffort: "xhigh",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "gemini",
    maxTokens: 65000,
    apiModel: "gemini-3-pro-preview",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "gemini",
    maxTokens: 65536,
    apiModel: "gemini-3-flash-preview",
  },
  {
    id: "claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    maxTokens: 128000,
    apiModel: "claude-opus-4-6",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    maxTokens: 64000,
    apiModel: "claude-sonnet-4-5-20250929",
  },
  {
    id: "mistral-medium-3.1",
    name: "Mistral Medium 3.1",
    provider: "mistral",
    maxTokens: 8192,
    apiModel: "mistral-medium-latest",
  },
  {
    id: "mistral-small-3.2",
    name: "Mistral Small 3.2",
    provider: "mistral",
    maxTokens: 8192,
    apiModel: "mistral-small-latest",
  },
  {
    id: "glm-5",
    name: "GLM-5",
    provider: "glm",
    maxTokens: 128000,
    apiModel: "glm-5",
  },
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "glm",
    maxTokens: 128000,
    apiModel: "glm-4.7",
  },
  {
    id: "glm-4.7-flash",
    name: "GLM-4.7 Flash",
    provider: "glm",
    maxTokens: 128000,
    apiModel: "glm-4.7-flash",
  },
  {
    id: "glm-4.6",
    name: "GLM-4.6",
    provider: "glm",
    maxTokens: 128000,
    apiModel: "glm-4.6",
  },
  {
    id: "glm-4.6v",
    name: "GLM-4.6V (Vision)",
    provider: "glm",
    maxTokens: 128000,
    apiModel: "glm-4.6v",
  },
];

export function getModelConfig(id: LLMModel): LLMModelConfig {
  return LLM_MODELS.find((m) => m.id === id)!;
}
