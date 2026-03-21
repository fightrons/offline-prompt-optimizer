# Prompt Optimizer

Hybrid prompt optimizer: free local cleanup + optional AI deep optimization with cost tradeoff analysis.

## Why hybrid?

Fully local = glorified text formatter. Fully AI = spending tokens to save tokens blindly. The sweet spot: do the free stuff locally, use AI only when it adds real value — and **prove it with numbers**.

> "Spend 1x tokens → save 10x tokens downstream."

## How it works

### Step 1 — Quick Optimize (Free, local)

Rule-based transformations that run instantly in the browser:

- **Verbose phrase replacement** — 40+ patterns ("in order to" → "to", "due to the fact that" → "because")
- **Filler word removal** — strips "please", "just", "basically", hedging language
- **Imperative conversion** — "Can you..." → direct commands
- **Redundant instruction removal** — "make sure that", "please note that"
- **Duplicate line removal** and whitespace cleanup
- **Structural analysis** — detects missing role, constraints, output format, and examples

### Step 2 — Deep Optimize with AI (Optional, ~$0.001)

One LLM call (GPT-4o-mini) that does real semantic transformation:

- Adds a clear role if missing
- Restructures complex prompts into sections
- Adds constraints and output format
- Rewrites for maximum clarity and token efficiency
- Preserves original intent completely

### Step 3 — Cost Tradeoff Display

After AI optimization, shows:

```
Optimization cost:   $0.0003
Saved per future use: $0.0021
Break-even:          1 use
```

This is the killer insight: **one optimization call pays for itself on the first reuse**.

## Tech stack

- React + Vite
- Zero dependencies beyond React
- OpenAI API (optional, for deep optimize only)

## Setup

```
npm install
npm run dev
```

No API key needed for local optimization. For AI optimization, enter your OpenAI API key in the app (stored in localStorage, sent only to OpenAI).
