import { Message, LLMModel, getModelConfig } from "@/types";
import { SYSTEM_PROMPT } from "./system-prompt";

interface StreamChatOptions {
    messages: Message[];
    apiKey: string;
    model: LLMModel;
    onChunk: (chunk: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    signal?: AbortSignal;
    systemPrompt?: string;
}

export async function streamChat(opts: StreamChatOptions) {
    const config = getModelConfig(opts.model);

    switch (config.provider) {
        case "openai":
            return streamOpenAI(opts);
        case "gemini":
            return streamGemini(opts);
        case "anthropic":
            return streamAnthropic(opts);
        case "mistral":
            return streamMistral(opts);
        case "glm":
            return streamGLM(opts);
        default:
            opts.onError(new Error(`Unknown provider: ${config.provider}`));
    }
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────

async function streamOpenAI(opts: StreamChatOptions) {
    const { messages, apiKey, model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const openaiMessages = [
        { role: "system" as const, content: sysPrompt },
        ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
    ];

    try {
        const body: Record<string, unknown> = {
            model: config.apiModel ?? model,
            messages: openaiMessages,
            stream: true,
            max_completion_tokens: config.maxTokens,
        };

        // Reasoning models use reasoning_effort instead of temperature
        if (config.reasoningEffort) {
            body.reasoning_effort = config.reasoningEffort;
        } else {
            body.temperature = 0.8;
        }

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
                signal,
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            if (data === "[DONE]") {
                onDone();
                return true;
            }
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Mistral ────────────────────────────────────────────────────────────────

async function streamMistral(opts: StreamChatOptions) {
    const { messages, apiKey, model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const mistralMessages = [
        { role: "system" as const, content: sysPrompt },
        ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
    ];

    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.apiModel ?? model,
                messages: mistralMessages,
                stream: true,
                max_tokens: config.maxTokens,
                temperature: 0.7,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Mistral API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            if (data === "[DONE]") {
                onDone();
                return true;
            }

            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;

                if (typeof delta === "string") {
                    onChunk(delta);
                    return false;
                }

                if (Array.isArray(delta)) {
                    for (const part of delta) {
                        if (part?.type === "text" && typeof part.text === "string") {
                            onChunk(part.text);
                        }
                    }
                    return false;
                }

                const text = parsed.choices?.[0]?.message?.content;
                if (typeof text === "string") onChunk(text);
            } catch {
                // skip malformed
            }

            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Google Gemini ──────────────────────────────────────────────────────────

async function streamGemini(opts: StreamChatOptions) {
    const { messages, apiKey, model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    const geminiModel = config.apiModel ?? model;

    // Build contents array for Gemini format
    const contents = [];

    // System instruction goes separately
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    const systemInstruction = { parts: [{ text: sysPrompt }] };

    for (const msg of messages) {
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: systemInstruction,
                    contents,
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 8192,
                    },
                }),
                signal,
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
        }

        await readSSEStream(response, (data) => {
            try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) onChunk(text);
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Anthropic (Claude) ─────────────────────────────────────────────────────

async function streamAnthropic(opts: StreamChatOptions) {
    const { messages, apiKey, model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);

    // Anthropic uses a messages format similar to OpenAI
    // but system goes in a separate field and only user/assistant roles
    const anthropicMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
                model: config.apiModel ?? model,
                max_tokens: config.maxTokens,
                system: opts.systemPrompt ?? SYSTEM_PROMPT,
                messages: anthropicMessages,
                stream: true,
                temperature: 0.8,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `Anthropic API error (${response.status}): ${errorBody}`
            );
        }

        await readSSEStream(response, (data) => {
            try {
                const parsed = JSON.parse(data);

                if (parsed.type === "content_block_delta") {
                    const text = parsed.delta?.text;
                    if (text) onChunk(text);
                } else if (parsed.type === "message_stop") {
                    onDone();
                    return true;
                }
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── GLM (Zhipu AI) ─────────────────────────────────────────────────────────

async function streamGLM(opts: StreamChatOptions) {
    const { messages, apiKey, model, onChunk, onDone, onError, signal } = opts;
    const config = getModelConfig(model);
    const sysPrompt = opts.systemPrompt ?? SYSTEM_PROMPT;

    // GLM uses OpenAI-style messages format with system in the array
    const glmMessages = [
        { role: "system" as const, content: sysPrompt },
        ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
    ];

    try {
        const response = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.apiModel ?? model,
                messages: glmMessages,
                stream: true,
                max_tokens: config.maxTokens,
                temperature: 0.8,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `GLM API error (${response.status}): ${errorBody}`
            );
        }

        await readSSEStream(response, (data) => {
            if (data === "[DONE]") {
                onDone();
                return true;
            }
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
            } catch {
                // skip malformed
            }
            return false;
        });

        onDone();
    } catch (error) {
        handleStreamError(error, onDone, onError);
    }
}

// ─── Shared SSE reader ──────────────────────────────────────────────────────

async function readSSEStream(
    response: Response,
    onData: (data: string) => boolean // return true to stop
) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            const shouldStop = onData(data);
            if (shouldStop) return;
        }
    }
}

function handleStreamError(
    error: unknown,
    onDone: () => void,
    onError: (error: Error) => void
) {
    if (error instanceof DOMException && error.name === "AbortError") {
        onDone();
        return;
    }
    onError(error instanceof Error ? error : new Error(String(error)));
}
