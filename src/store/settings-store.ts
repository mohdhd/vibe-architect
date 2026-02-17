import { create } from "zustand";
import { LLMModel } from "@/types";

type KeyProvider = "openai" | "gemini" | "anthropic" | "mistral" | "glm";

interface SettingsState {
    // API Keys
    openaiKey: string;
    geminiKey: string;
    anthropicKey: string;
    mistralKey: string;
    glmKey: string;

    // Model selection
    activeLLMModel: LLMModel;

    // Derived
    isConfigured: boolean;

    // Actions
    setKey: (provider: KeyProvider, value: string) => void;
    setLLMModel: (model: LLMModel) => void;
    clearKeys: () => void;
    loadFromStorage: () => void;

    // Helpers
    getKeyForProvider: (provider: "openai" | "gemini" | "anthropic" | "mistral" | "glm") => string;
    hasKeyForModel: (model: LLMModel) => boolean;
}

const STORAGE_KEY = "vibe-architect-settings";

function computeIsConfigured(state: {
    openaiKey: string;
    geminiKey: string;
    anthropicKey: string;
    mistralKey: string;
    glmKey: string;
}): boolean {
    return (
        state.openaiKey.length > 0 ||
        state.geminiKey.length > 0 ||
        state.anthropicKey.length > 0 ||
        state.mistralKey.length > 0 ||
        state.glmKey.length > 0
    );
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    openaiKey: "",
    geminiKey: "",
    anthropicKey: "",
    mistralKey: "",
    glmKey: "",
    activeLLMModel: "gpt-5.2-high",
    isConfigured: false,

    setKey: (provider, value) => {
        const keyMap: Record<KeyProvider, string> = {
            openai: "openaiKey",
            gemini: "geminiKey",
            anthropic: "anthropicKey",
            mistral: "mistralKey",
            glm: "glmKey",
        };
        const update = { [keyMap[provider]]: value };
        const state = { ...get(), ...update };
        set({
            ...update,
            isConfigured: computeIsConfigured(
                state as typeof state & {
                    openaiKey: string;
                    geminiKey: string;
                    anthropicKey: string;
                    mistralKey: string;
                    glmKey: string;
                }
            ),
        });
        persistSettings({ ...get(), ...update });
    },

    setLLMModel: (model) => {
        set({ activeLLMModel: model });
        persistSettings({ ...get(), activeLLMModel: model });
    },

    clearKeys: () => {
        set({
            openaiKey: "",
            geminiKey: "",
            anthropicKey: "",
            mistralKey: "",
            glmKey: "",
            isConfigured: false,
        });
        localStorage.removeItem(STORAGE_KEY);
    },

    loadFromStorage: () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const p = JSON.parse(stored);
                const state = {
                    openaiKey: p.openaiKey || "",
                    geminiKey: p.geminiKey || "",
                    anthropicKey: p.anthropicKey || "",
                    mistralKey: p.mistralKey || "",
                    glmKey: p.glmKey || "",
                    activeLLMModel: p.activeLLMModel || "gpt-5.2-high",
                };
                set({
                    ...state,
                    isConfigured: computeIsConfigured(state),
                });
            }
        } catch {
            // ignore corrupted storage
        }
    },

    getKeyForProvider: (provider) => {
        const s = get();
        return provider === "openai"
            ? s.openaiKey
            : provider === "gemini"
                ? s.geminiKey
                : provider === "anthropic"
                    ? s.anthropicKey
                    : provider === "mistral"
                        ? s.mistralKey
                        : s.glmKey;
    },

    hasKeyForModel: (model) => {
        const s = get();
        if (model.startsWith("gpt-")) return s.openaiKey.length > 0;
        if (model.startsWith("gemini")) return s.geminiKey.length > 0;
        if (model.startsWith("claude")) return s.anthropicKey.length > 0;
        if (model.startsWith("mistral")) return s.mistralKey.length > 0;
        if (model.startsWith("glm")) return s.glmKey.length > 0;
        return false;
    },
}));

function persistSettings(state: Record<string, unknown>) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                openaiKey: state.openaiKey,
                geminiKey: state.geminiKey,
                anthropicKey: state.anthropicKey,
                mistralKey: state.mistralKey,
                glmKey: state.glmKey,
                activeLLMModel: state.activeLLMModel,
            })
        );
    } catch {
        // storage full or unavailable
    }
}
