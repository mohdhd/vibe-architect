<p align="center">
  <h1 align="center">🏗️ Vibe Architect</h1>
  <p align="center">
    AI-powered project spec generator — go from idea to implementation-ready spec in minutes.
  </p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#supported-models">Supported Models</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="https://specs-gen.vercel.app"><strong>🌐 Live Demo</strong></a> &nbsp;·&nbsp;
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmohdhd%2Fvibe-architect"><img src="https://vercel.com/button" alt="Deploy with Vercel" height="24" /></a>
</p>

---

## What is Vibe Architect?

Vibe Architect is an open-source tool that helps you turn a raw app idea into a structured, coding-agent-ready implementation spec. Instead of staring at a blank doc, you have a conversation with an AI architect that **proactively proposes** options for your MVP scope, design system, and tech stack — then generates a complete markdown spec you can hand off to any coding agent or dev team.

**You don't have to complete all steps.** Stop at any phase when your plan feels complete.

## Features

- **Guided brainstorming** — The AI proposes concrete options (not open-ended questions) through a Propose → Refine → Lock workflow
- **Live design previews** — See your design system rendered in real-time as the AI generates React component previews
- **Multi-model support** — Bring your own API key for OpenAI (GPT-5.2), Google (Gemini 3), Anthropic (Claude Opus/Sonnet), or Mistral (Medium/Small)
- **Voice input** — Speak your ideas using the built-in mic button (Whisper-powered transcription)
- **Spec editor** — Edit generated specs directly in the built-in markdown editor
- **Export** — Download your complete spec as markdown files, ready for your coding workflow
- **Fully client-side** — No backend, no data leaves your browser (API calls go directly to providers)
- **First-time usage guide** — Onboarding modal for new users

## How It Works

| Phase | What Happens |
|---|---|
| **1. Vision & Scope** | Define your MVP — the AI suggests features to include and cut |
| **2. Design System** | Pick a visual identity from AI-proposed "vibes" with live previews |
| **3. Tech Stack** | Get an opinionated, tailored stack recommendation |
| **4. Implementation Spec** | Generate a complete, coding-agent-ready markdown spec |

Each phase follows **Propose → Refine → Lock**. The AI always asks for your confirmation before locking a phase and moving on.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- An API key from at least one supported provider

### Installation

```bash
# Clone the repository
git clone https://github.com/mohdhd/vibe-architect.git
cd vibe-architect

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

Click the **⚙️ Settings** icon in the app and add your API key(s):

| Provider | Models |
|---|---|
| OpenAI | GPT-5.2 (High / Medium / XHigh) |
| Google | Gemini 3 Pro, Gemini 3 Flash |
| Anthropic | Claude Opus 4.6, Claude Sonnet 4.5 |
| Mistral | Mistral Medium 3.1, Mistral Small 3.2 |
| GLM (Zhipu AI) | GLM-5, GLM-4.7, GLM-4.7 Flash, GLM-4.6, GLM-4.6V |

Keys are stored locally in your browser — they never leave your machine.

## Supported Models

| Model | Provider | Max Output Tokens |
|---|---|---|
| GPT-5.2 (High/Medium/XHigh) | OpenAI | 128,000 |
| Gemini 3 Pro | Google | 65,000 |
| Gemini 3 Flash | Google | 65,536 |
| Claude Opus 4.6 | Anthropic | 128,000 |
| Claude Sonnet 4.5 | Anthropic | 64,000 |
| Mistral Medium 3.1 | Mistral | 8,192 |
| Mistral Small 3.2 | Mistral | 8,192 |
| GLM-5 | GLM (Zhipu AI) | 128,000 |
| GLM-4.7 | GLM (Zhipu AI) | 128,000 |
| GLM-4.7 Flash | GLM (Zhipu AI) | 128,000 |
| GLM-4.6 | GLM (Zhipu AI) | 128,000 |
| GLM-4.6V (Vision) | GLM (Zhipu AI) | 128,000 |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 |
| UI | React 19, Tailwind CSS 4 |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Persistence | IndexedDB via [idb-keyval](https://github.com/nickersoft/idb-keyval) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm |
| Export | [JSZip](https://stuk.github.io/jszip/) + [FileSaver](https://github.com/nickersoft/fileSaver.js) |
| Voice | Browser MediaRecorder + OpenAI Whisper API |
| Preview Sandbox | Babel (runtime JSX transform) + React CDN |

## Project Structure

```
src/
├── app/               # Next.js app router
│   └── page.tsx       # Main page with layout
├── components/        # React components
│   ├── chat-panel.tsx       # Chat interface
│   ├── sandbox-panel.tsx    # Design preview + spec editor
│   ├── settings-modal.tsx   # API key configuration
│   ├── export-modal.tsx     # Spec export dialog
│   ├── mic-button.tsx       # Voice input (Whisper)
│   ├── usage-guide.tsx      # First-time onboarding
│   └── ...
├── lib/               # Core logic
│   ├── llm-client.ts        # Multi-provider LLM streaming
│   └── system-prompt.ts     # AI persona & workflow prompts
├── store/             # Zustand stores
│   ├── project-store.ts     # Projects, conversations, specs
│   └── settings-store.ts    # API keys, model selection
└── types/             # TypeScript types & model configs
    └── index.ts
```

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
```

## License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️
</p>
