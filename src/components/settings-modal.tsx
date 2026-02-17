"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/settings-store";
import { LLM_MODELS } from "@/types";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const s = useSettingsStore();

    const [keys, setKeys] = useState({
        openai: s.openaiKey,
        gemini: s.geminiKey,
        anthropic: s.anthropicKey,
        mistral: s.mistralKey,
        glm: s.glmKey,
    });
    const [showKeys, setShowKeys] = useState(false);

    useEffect(() => {
        setKeys({
            openai: s.openaiKey,
            gemini: s.geminiKey,
            anthropic: s.anthropicKey,
            mistral: s.mistralKey,
            glm: s.glmKey,
        });
    }, [s.openaiKey, s.geminiKey, s.anthropicKey, s.mistralKey, s.glmKey, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        s.setKey("openai", keys.openai.trim());
        s.setKey("gemini", keys.gemini.trim());
        s.setKey("anthropic", keys.anthropic.trim());
        s.setKey("mistral", keys.mistral.trim());
        s.setKey("glm", keys.glm.trim());
        onClose();
    };

    const handleClear = () => {
        s.clearKeys();
        setKeys({ openai: "", gemini: "", anthropic: "", mistral: "", glm: "" });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--accent-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-primary)]"
                    >
                        ✕
                    </button>
                </div>

                {/* ── API Keys ─────────────────────────────────────────── */}
                <Section title="API Keys">
                    <KeyInput
                        label="OpenAI"
                        value={keys.openai}
                        onChange={(v) => setKeys({ ...keys, openai: v })}
                        placeholder="sk-..."
                        show={showKeys}
                        configured={s.openaiKey.length > 0}
                    />
                    <KeyInput
                        label="Google Gemini"
                        value={keys.gemini}
                        onChange={(v) => setKeys({ ...keys, gemini: v })}
                        placeholder="AIza..."
                        show={showKeys}
                        configured={s.geminiKey.length > 0}
                    />
                    <KeyInput
                        label="Anthropic"
                        value={keys.anthropic}
                        onChange={(v) => setKeys({ ...keys, anthropic: v })}
                        placeholder="sk-ant-..."
                        show={showKeys}
                        configured={s.anthropicKey.length > 0}
                    />
                    <KeyInput
                        label="Mistral"
                        value={keys.mistral}
                        onChange={(v) => setKeys({ ...keys, mistral: v })}
                        placeholder="your-mistral-key"
                        show={showKeys}
                        configured={s.mistralKey.length > 0}
                    />
                    <KeyInput
                        label="GLM (Zhipu AI)"
                        value={keys.glm}
                        onChange={(v) => setKeys({ ...keys, glm: v })}
                        placeholder="your-glm-api-key"
                        show={showKeys}
                        configured={s.glmKey.length > 0}
                    />
                    <button
                        onClick={() => setShowKeys(!showKeys)}
                        className="mt-1 text-xs text-[var(--accent-dim)] transition-colors hover:text-[var(--accent-muted)]"
                    >
                        {showKeys ? "Hide keys" : "Show keys"}
                    </button>
                </Section>

                {/* ── LLM Model ────────────────────────────────────────── */}
                <Section title="Chat Model">
                    <div className="grid grid-cols-1 gap-1.5">
                        {LLM_MODELS.map((m) => {
                            const hasKey =
                                m.provider === "openai" ? keys.openai.trim().length > 0
                                    : m.provider === "gemini" ? keys.gemini.trim().length > 0
                                        : m.provider === "anthropic" ? keys.anthropic.trim().length > 0
                                            : m.provider === "mistral" ? keys.mistral.trim().length > 0
                                                : m.provider === "glm" ? keys.glm.trim().length > 0
                                                    : false;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => s.setLLMModel(m.id)}
                                    disabled={!hasKey}
                                    className={`flex items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${s.activeLLMModel === m.id
                                        ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]"
                                        : hasKey
                                            ? "border-[var(--border-subtle)] text-[var(--accent-muted)] hover:border-[var(--border-focus)]"
                                            : "border-[var(--border-subtle)] text-[var(--accent-dim)] opacity-40 cursor-not-allowed"
                                        }`}
                                >
                                    <span>{m.name}</span>
                                    <span className="text-xs text-[var(--accent-dim)]">
                                        {m.provider}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Section>

                {/* ── Actions ──────────────────────────────────────────── */}
                <div className="mt-6 flex items-center justify-between">
                    <button
                        onClick={handleClear}
                        className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--accent-error)] transition-colors hover:bg-[var(--accent-error)]/10"
                    >
                        Clear All Keys
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-4 py-1.5 text-sm text-[var(--accent-muted)] transition-colors hover:bg-[var(--bg-elevated)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-[var(--bg-base)] transition-colors hover:bg-[var(--accent-muted)]"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Helper components ───────────────────────────────────────────────────────

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-[var(--accent-muted)] uppercase tracking-wider">
                {title}
            </h3>
            {children}
        </div>
    );
}

function KeyInput({
    label,
    value,
    onChange,
    placeholder,
    show,
    configured,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    show: boolean;
    configured: boolean;
}) {
    return (
        <div className="mb-3">
            <div className="mb-1 flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--accent-muted)]">
                    {label}
                </label>
                <span
                    className={`inline-block h-2 w-2 rounded-full ${configured
                        ? "bg-[var(--accent-success)]"
                        : "bg-[var(--accent-dim)]"
                        }`}
                />
            </div>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 font-mono text-sm text-[var(--accent-primary)] placeholder-[var(--accent-dim)] transition-colors focus:border-[var(--border-focus)] focus:outline-none"
            />
        </div>
    );
}

function ToggleBtn({
    label,
    active,
    onClick,
    disabled,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors ${active
                ? "border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--accent-primary)]"
                : disabled
                    ? "border-[var(--border-subtle)] text-[var(--accent-dim)] opacity-40 cursor-not-allowed"
                    : "border-[var(--border-subtle)] text-[var(--accent-dim)] hover:border-[var(--border-focus)] hover:text-[var(--accent-muted)]"
                }`}
        >
            {label}
        </button>
    );
}
