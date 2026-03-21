# Prompt Optimizer

A 100% local, offline prompt optimizer. Paste a prompt, get a shorter one — no API calls, no tokens spent.

## Why

Using an LLM to optimize prompts defeats the purpose — you're spending tokens to save tokens. This tool runs entirely in the browser with rule-based transformations.

## What it does

1. You paste a prompt
2. Click "Optimize"
3. It returns:
   - A shorter, cleaner prompt
   - What changed (list of transformations applied)
   - Token estimate before/after + % reduction

## How it works

The optimizer applies these transformations locally:

- **Verbose phrase replacement** — 40+ patterns like "in order to" → "to", "due to the fact that" → "because", "provide a summary of" → "summarize"
- **Filler word removal** — strips "please", "just", "really", "basically", "honestly", "I think", "I believe", hedging language
- **Imperative conversion** — "Can you...", "Could you..." → direct commands
- **Redundant instruction removal** — "make sure that", "please note that", "keep in mind that", "don't forget to"
- **Duplicate line removal** — deduplicates repeated lines
- **Whitespace cleanup** — collapses excess spaces/newlines
- **Token estimation** — word count × 1.3 (simple approximation)

## Tech stack

- React + Vite
- Zero external dependencies beyond React
- Single-page app, ~130 lines of UI + ~150 lines of optimizer logic

## Setup

```
npm install
npm run dev
```

Opens at `http://localhost:5173/`.

## Build

```
npm run build
```

Output goes to `dist/` — static files, deploy anywhere.
