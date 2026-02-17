"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Markdown from "@/components/markdown";
import { useProjectStore } from "@/store/project-store";
import { useSettingsStore } from "@/store/settings-store";
import { streamChat } from "@/lib/llm-client";
import { getModelConfig, ConversationPhase } from "@/types";

type TabMode = "preview" | "markdown" | "editor";

export default function SandboxPanel() {
  const { activeConversationId, getActiveConversation, setSandboxCode, setSpecDoc } =
    useProjectStore();
  const { activeLLMModel, getKeyForProvider, isConfigured } = useSettingsStore();
  const conversation = getActiveConversation();
  const sandboxCode = conversation?.sandboxCode;

  const [activeTab, setActiveTab] = useState<TabMode>("preview");
  const [editorContent, setEditorContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Collect specDocs content
  const specDocs = conversation?.specDocs || {};

  // Build combined markdown from all spec docs for the editor
  const PHASE_LIST: ConversationPhase[] = ["vision", "design", "stack", "export"];
  const PHASE_FILE: Record<ConversationPhase, string> = {
    vision: "@01-vision.md",
    design: "@02-design.md",
    stack: "@03-stack.md",
    export: "@04-implementation.md",
  };

  const combinedMarkdown = PHASE_LIST
    .filter((p) => specDocs[p]?.trim())
    .map((p) => `<!-- ${PHASE_FILE[p]} -->\n${specDocs[p]}`)
    .join("\n\n---\n\n");

  // Sync editor content when spec docs change
  useEffect(() => {
    if (combinedMarkdown) {
      setEditorContent(combinedMarkdown);
    }
  }, [combinedMarkdown]);

  const handleEditorApply = useCallback(() => {
    if (!activeConversationId || !editorContent.trim()) return;
    const sections = editorContent.split(/<!--\s*(@\d+-\w+\.md)\s*-->/);
    for (let i = 1; i < sections.length; i += 2) {
      const fileName = sections[i];
      const content = (sections[i + 1] || "").replace(/^[\s-]+|[\s-]+$/g, "").trim();
      const phase = PHASE_LIST.find((p) => PHASE_FILE[p] === fileName);
      if (phase && content) {
        setSpecDoc(activeConversationId, phase, content);
      }
    }
  }, [activeConversationId, editorContent, setSpecDoc]);

  const hasSpecs = !!(specDocs.vision || specDocs.design);

  // Capture the current sandbox code at the moment the user clicks Generate
  const designCodeSnapshotRef = useRef<string>("");

  const handleGeneratePreview = useCallback(() => {
    if (isGenerating || !isConfigured || !activeConversationId) return;

    // Snapshot the design code NOW before generation starts
    const existingCode = sandboxCode || "";
    designCodeSnapshotRef.current = existingCode;

    const visionSpec = specDocs.vision || "";
    const designSpec = specDocs.design || "";

    const prompt = `Generate a COMPACT but visually polished React landing page component.

${existingCode ? `## Existing Design Code (REUSE these exact styles)\n\`\`\`jsx\n${existingCode}\n\`\`\`\n` : ""}
${visionSpec ? `## Vision\n${visionSpec}\n` : ""}
${designSpec ? `## Design System\n${designSpec}\n` : ""}

STRICT RULES:
1. Define ONE function called \`App\` — no other exports
2. Use INLINE STYLES ONLY (no CSS imports, no Tailwind, no className)
3. Keep the component UNDER 250 lines of code total — be concise
4. Store repeated style objects in variables at the top (e.g. \`const colors = {...}\`)
5. Include: nav bar, hero, 3 feature cards, CTA section, footer
6. Use realistic but SHORT placeholder text (1-2 sentences max per section)
7. The code MUST be complete and valid — every tag must be properly closed
8. End with a clean closing brace for the App function
9. No explanations, no markdown fences, no text outside the code
10. NEVER use emoji characters or special unicode symbols inside JSX text — use plain ASCII only
11. For void elements (img, br, hr, input) ALWAYS use self-closing syntax: <img />, <br />, <hr />
12. NEVER use nested ternary expressions in JSX — extract conditional logic into variables before the return
13. Always wrap multi-line JSX expressions in parentheses
14. Every string attribute must use matching quotes — never leave a quote unclosed

Output ONLY the raw JavaScript/JSX code.`;

    setIsGenerating(true);
    const config = getModelConfig(activeLLMModel);
    const apiKey = getKeyForProvider(config.provider);
    const abortController = new AbortController();
    abortRef.current = abortController;
    let fullResponse = "";

    const codeSystemPrompt = `You are a code generator that outputs ONLY valid, complete JSX code. Rules:
- Output raw JavaScript/JSX only. No markdown, no explanations, no conversation.
- Always define a function called App.
- Keep code compact: use style variables, avoid repetition.
- NEVER leave JSX tags unclosed. Every opening tag MUST have a closing tag.
- NEVER use emojis or special unicode characters in JSX text content. Use plain ASCII text only.
- For self-closing HTML tags (img, br, hr, input), ALWAYS use the /> self-closing syntax.
- The last line of output must be the closing brace of the App function.`;

    streamChat({
      messages: [
        { id: "", role: "user", content: prompt, timestamp: Date.now() },
      ],
      apiKey,
      model: activeLLMModel,
      signal: abortController.signal,
      systemPrompt: codeSystemPrompt,
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onDone: () => {
        let cleaned = fullResponse.trim();
        // Strip code fences if AI wraps output
        const fenceMatch = cleaned.match(/^```(?:jsx?|tsx?|react|javascript)?\s*\n([\s\S]*?)\n\s*```\s*$/);
        if (fenceMatch) cleaned = fenceMatch[1].trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:jsx?|tsx?|react|javascript)?\s*\n/, "").trim();
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.replace(/\n?```\s*$/, "").trim();
        }

        // Truncation repair: close any unclosed braces/parens/tags
        cleaned = repairTruncatedCode(cleaned);

        // Validate JSX by attempting a Babel transform before saving
        try {
          // Quick validation: see if Babel can parse it
          // We do this in a Function constructor to avoid needing Babel as a direct dep
          // The actual parsing happens via a simple regex check + structural validation
          validateJSXStructure(cleaned);
          setPreviewError(null);
          setSandboxCode(activeConversationId!, cleaned);
        } catch (validationErr: unknown) {
          const errMsg = validationErr instanceof Error ? validationErr.message : String(validationErr);
          console.error("Generated code validation failed:", errMsg);
          // Keep the old code
          if (designCodeSnapshotRef.current) {
            setSandboxCode(activeConversationId!, designCodeSnapshotRef.current);
          }
          setPreviewError(`Preview generation failed: ${errMsg}. The previous preview has been restored.`);
        }
        setIsGenerating(false);
        abortRef.current = null;
      },
      onError: (error) => {
        console.error("Preview generation error:", error);
        // Restore old code on error
        if (designCodeSnapshotRef.current) {
          setSandboxCode(activeConversationId!, designCodeSnapshotRef.current);
        }
        setPreviewError(`Preview generation error: ${error.message}. The previous preview has been restored.`);
        setIsGenerating(false);
        abortRef.current = null;
      },
    });
  }, [isGenerating, isConfigured, activeConversationId, specDocs, sandboxCode, activeLLMModel, getKeyForProvider, setSandboxCode]);

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  if (!activeConversationId) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <p className="text-xs text-[var(--accent-dim)]">
          Preview panel
        </p>
      </div>
    );
  }

  const tabs: { id: TabMode; label: string; icon: string }[] = [
    { id: "preview", label: "Design", icon: "🎨" },
    { id: "markdown", label: "Spec", icon: "📄" },
    { id: "editor", label: "Editor", icon: "✏️" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex h-9 items-center gap-0 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex h-full items-center gap-1 px-2.5 sm:px-4 text-xs font-medium transition-all border-b-2 ${activeTab === tab.id
              ? "border-[var(--accent-primary)] text-[var(--accent-primary)]"
              : "border-transparent text-[var(--accent-dim)] hover:text-[var(--accent-muted)]"
              }`}
          >
            <span className="text-[10px]">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}

        {/* Status + Generate button (Design tab only) */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-3">
          {activeTab === "preview" && sandboxCode && !isGenerating && (
            <>
              <span className="h-2 w-2 rounded-full bg-[var(--accent-success)]" />
              <span className="hidden sm:inline text-xs text-[var(--accent-dim)]">Live</span>
            </>
          )}
          {activeTab === "preview" && isGenerating && (
            <button
              onClick={handleStopGeneration}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-red-500/30 px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              ⏹ Stop
            </button>
          )}
          {activeTab === "preview" && hasSpecs && !isGenerating && (
            <button
              onClick={handleGeneratePreview}
              disabled={!isConfigured}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-2 sm:px-2.5 py-1 text-[10px] font-medium text-[var(--bg-base)] transition-all hover:brightness-110 disabled:opacity-30 whitespace-nowrap"
            >
              🚀 <span className="hidden sm:inline">Generate Full Preview</span><span className="sm:hidden">Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "preview" && (
          <DesignPreviewTab
            sandboxCode={sandboxCode ?? null}
            isGenerating={isGenerating}
            hasSpecs={hasSpecs}
          />
        )}
        {activeTab === "markdown" && (
          <SpecTab specDocs={specDocs} />
        )}
        {activeTab === "editor" && (
          <EditorTab
            content={editorContent}
            onChange={setEditorContent}
            onApply={handleEditorApply}
            editorRef={editorRef}
          />
        )}

        {/* Error snackbar */}
        {previewError && (
          <div className="absolute bottom-4 left-4 right-4 z-50 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--accent-error)]/30 bg-[var(--bg-elevated)] px-4 py-3 shadow-lg animate-fade-in">
            <span className="mt-0.5 text-[var(--accent-error)]">⚠</span>
            <p className="flex-1 text-xs text-[var(--accent-muted)] leading-relaxed">{previewError}</p>
            <button
              onClick={() => setPreviewError(null)}
              className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-medium text-[var(--accent-error)] border border-[var(--accent-error)]/30 transition-colors hover:bg-[var(--accent-error)]/10"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Design Preview Tab ──

// ── Design Preview Tab ──

function DesignPreviewTab({
  sandboxCode,
  isGenerating,
  hasSpecs,
}: {
  sandboxCode: string | null;
  isGenerating: boolean;
  hasSpecs: boolean;
}) {
  if (isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-6">
        <div className="mb-3 animate-spin text-2xl">⏳</div>
        <p className="text-sm text-[var(--accent-primary)]">
          Generating full page preview...
        </p>
        <p className="mt-1 text-xs text-[var(--accent-dim)]/60">
          The AI is building a complete page with your design system.
        </p>
      </div>
    );
  }

  if (!sandboxCode) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-6">
        <div className="mb-3 text-2xl">🎨</div>
        <p className="text-sm text-[var(--accent-dim)]">
          {hasSpecs
            ? "Click \"Generate Full Preview\" above to see your design!"
            : "Waiting for AI to generate a design preview..."}
        </p>
        <p className="mt-1 text-xs text-[var(--accent-dim)]/60">
          {hasSpecs
            ? "The AI will create a full landing page with your design system."
            : "Lock your Vision & Design phases first."}
        </p>
      </div>
    );
  }

  const srcdoc = buildSandboxHtml(sandboxCode);

  return (
    <iframe
      srcDoc={srcdoc}
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts"
      title="Design Preview"
    />
  );
}

// ── Spec Tab (shows locked phase docs) ──

const PHASE_ORDER: ConversationPhase[] = ["vision", "design", "stack", "export"];
const PHASE_FILE_NAMES: Record<ConversationPhase, string> = {
  vision: "@01-vision.md",
  design: "@02-design.md",
  stack: "@03-stack.md",
  export: "@04-implementation.md",
};
const PHASE_LABELS: Record<ConversationPhase, string> = {
  vision: "Vision & Scope",
  design: "Design System",
  stack: "Tech Stack",
  export: "Implementation",
};

function SpecTab({ specDocs }: { specDocs: Partial<Record<ConversationPhase, string>> }) {
  const hasAnyDocs = Object.values(specDocs).some((v) => v && v.trim());
  const [copied, setCopied] = useState(false);

  const allMarkdown = PHASE_ORDER
    .filter((p) => specDocs[p]?.trim())
    .map((p) => `# ${PHASE_FILE_NAMES[p]}\n\n${specDocs[p]}`)
    .join("\n\n---\n\n");

  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(allMarkdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [allMarkdown]);

  if (!hasAnyDocs) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-6">
        <div className="mb-3 text-2xl">📄</div>
        <p className="text-sm text-[var(--accent-dim)]">
          No spec documents yet
        </p>
        <p className="mt-1 text-xs text-[var(--accent-dim)]/60">
          Lock a phase in the chat to generate its spec document.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-5 py-4">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"
        >
          {copied ? "✅ Copied!" : "📋 Copy All Specs"}
        </button>
      </div>
      {PHASE_ORDER.map((phase) => {
        const doc = specDocs[phase];
        if (!doc || !doc.trim()) return null;

        return (
          <div key={phase} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent-primary)]">
                {PHASE_FILE_NAMES[phase]}
              </span>
              <span className="text-xs text-[var(--accent-dim)]">
                {PHASE_LABELS[phase]}
              </span>
            </div>
            <div className="min-w-0 overflow-hidden text-sm text-[var(--accent-muted)]">
              <Markdown>
                {doc}
              </Markdown>
            </div>
            <hr className="my-6 border-[var(--border-subtle)]" />
          </div>
        );
      })}
    </div>
  );
}

// ── Editor Tab ──

function EditorTab({
  content,
  onChange,
  onApply,
  editorRef,
}: {
  content: string;
  onChange: (value: string) => void;
  onApply: () => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onApply();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col">
      <textarea
        ref={editorRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 resize-none bg-[var(--bg-base)] px-4 py-3 font-mono text-xs text-[var(--accent-muted)] outline-none placeholder:text-[var(--accent-dim)]/40"
        placeholder="Edit the generated spec markdown here. Click Save to update the spec documents."
        spellCheck={false}
      />
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2">
        <span className="text-xs text-[var(--accent-dim)]">
          {content.split("\n").length} lines
        </span>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-[var(--accent-success)] animate-fade-in">
              ✓ Spec saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-colors hover:bg-[var(--accent-muted)] disabled:opacity-30"
          >
            Save Spec
          </button>
        </div>
      </div>
    </div>
  );
}

// ── JSX Structure Validation ──

function validateJSXStructure(code: string): void {
  // Check for unclosed string literals
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let braces = 0;
  let parens = 0;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';

    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '`' && prev !== '\\') inTemplate = false;
      continue;
    }
    // Skip single-line comments
    if (ch === '/' && i + 1 < code.length && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    // Skip multi-line comments
    if (ch === '/' && i + 1 < code.length && code[i + 1] === '*') {
      i += 2;
      while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
    else if (ch === '`') { inTemplate = true; }
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
  }

  if (inString) throw new Error('Unclosed string literal detected');
  if (inTemplate) throw new Error('Unclosed template literal detected');
  if (braces !== 0) throw new Error(`Mismatched braces: ${braces > 0 ? braces + ' unclosed' : Math.abs(braces) + ' extra closing'}`);
  if (parens !== 0) throw new Error(`Mismatched parentheses: ${parens > 0 ? parens + ' unclosed' : Math.abs(parens) + ' extra closing'}`);

  // Check that it contains a function definition (App or similar)
  if (!/function\s+\w+/.test(code)) {
    throw new Error('No function component found in generated code');
  }
}

// ── Truncation Repair ──

function repairTruncatedCode(code: string): string {
  // Count unclosed braces, parens, and JSX tags
  let braces = 0;
  let parens = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';

    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '`' && prev !== '\\') inTemplate = false;
      continue;
    }

    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
    else if (ch === '`') { inTemplate = true; }
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
  }

  // Find unclosed JSX tags (simple heuristic: look for <TagName that wasn't closed)
  const openTagRe = /<([A-Z][A-Za-z0-9.]*)[^>]*(?<!\/)>/g;
  const closeTagRe = /<\/([A-Z][A-Za-z0-9.]*)>/g;
  const selfCloseRe = /<([A-Z][A-Za-z0-9.]*)[^>]*\/>/g;

  const tagStack: string[] = [];
  const allTags: { type: 'open' | 'close' | 'self'; name: string; index: number }[] = [];

  let m;
  while ((m = openTagRe.exec(code)) !== null) allTags.push({ type: 'open', name: m[1], index: m.index });
  while ((m = closeTagRe.exec(code)) !== null) allTags.push({ type: 'close', name: m[1], index: m.index });
  while ((m = selfCloseRe.exec(code)) !== null) allTags.push({ type: 'self', name: m[1], index: m.index });

  allTags.sort((a, b) => a.index - b.index);

  for (const tag of allTags) {
    if (tag.type === 'open') tagStack.push(tag.name);
    else if (tag.type === 'close') {
      const lastIdx = tagStack.lastIndexOf(tag.name);
      if (lastIdx >= 0) tagStack.splice(lastIdx, 1);
    }
    // self-closing: no-op
  }

  // Build the repair suffix
  let suffix = '';

  // Close unclosed string/template literals first
  if (inTemplate) suffix += '`';
  if (inString) suffix += stringChar;

  // Close unclosed JSX tags in reverse order
  for (let i = tagStack.length - 1; i >= 0; i--) {
    suffix += `\n</${tagStack[i]}>`;
  }

  // Close unclosed parens and braces
  if (parens > 0) suffix += '\n' + ')'.repeat(parens) + ';';
  if (braces > 0) suffix += '\n' + '}'.repeat(braces);

  if (suffix) {
    code = code + suffix;
  }

  return code;
}

// ── Sandbox HTML Builder ──

function buildSandboxHtml(code: string): string {
  const cleanedCode = code
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+default\s+/g, "const __default__ = ")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+/g, "const ")
    .replace(/export\s+class\s+/g, "class ");

  // Escape <\/script> inside the code to prevent HTML parser from closing the tag
  const safeCode = cleanedCode.replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; }
    #root { min-height: 100vh; }
    .sandbox-error {
      color: #ef4444;
      padding: 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      white-space: pre-wrap;
      background: #1a1a1a;
      border-left: 3px solid #ef4444;
      margin: 1rem;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script id="__user_code__" type="text/plain">
${safeCode}
  </script>
  <script>
    (function() {
      var rootEl = document.getElementById('root');
      var rawCode = document.getElementById('__user_code__').textContent;

      // Transform JSX via Babel at runtime so parse errors are catchable
      var transformed;
      try {
        transformed = Babel.transform(rawCode, { presets: ['react'] }).code;
      } catch (parseErr) {
        rootEl.innerHTML = '<div class="sandbox-error">JSX Parse Error:\\n' + parseErr.message + '</div>';
        return;
      }

      // Evaluate the transformed code
      try {
        var fn = new Function('React', 'ReactDOM', transformed + ';\\nreturn { App: typeof App !== "undefined" ? App : undefined, DesignPreview: typeof DesignPreview !== "undefined" ? DesignPreview : undefined, Preview: typeof Preview !== "undefined" ? Preview : undefined, Component: typeof Component !== "undefined" ? Component : undefined, Main: typeof Main !== "undefined" ? Main : undefined, Home: typeof Home !== "undefined" ? Home : undefined, Page: typeof Page !== "undefined" ? Page : undefined, Hero: typeof Hero !== "undefined" ? Hero : undefined, Dashboard: typeof Dashboard !== "undefined" ? Dashboard : undefined, LandingPage: typeof LandingPage !== "undefined" ? LandingPage : undefined, __default__: typeof __default__ !== "undefined" ? __default__ : undefined };');
        var exports = fn(React, ReactDOM);
      } catch (runErr) {
        rootEl.innerHTML = '<div class="sandbox-error">Runtime Error:\\n' + runErr.message + '</div>';
        return;
      }

      // Find the first valid component
      var names = ['App','DesignPreview','Preview','Component','Main','Home','Page','Hero','Dashboard','LandingPage','__default__'];
      var comp = null;
      for (var i = 0; i < names.length; i++) {
        if (typeof exports[names[i]] === 'function') { comp = exports[names[i]]; break; }
      }

      if (comp) {
        try {
          ReactDOM.createRoot(rootEl).render(React.createElement(comp));
        } catch (renderErr) {
          rootEl.innerHTML = '<div class="sandbox-error">Render Error:\\n' + renderErr.message + '</div>';
        }
      } else {
        rootEl.innerHTML = '<div class="sandbox-error">No React component found to render.\\n\\nMake sure your code defines a function component like:\\n  function App() { return React.createElement("div", null, "Hello"); }</div>';
      }
    })();
  </script>
</body>
</html>`;
}
