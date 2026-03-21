# Prompt Optimizer

A prompt structuring engine that transforms messy, conversational prompts into structured, token-efficient formats. Free local optimization + optional AI deep optimize with cost tradeoff analysis.

> "Most prompt optimization tools try to shorten prompts. This one structures them — because structure reduces retries, not just tokens."

## What it does

Paste a prompt like this (333 tokens):

```
Hey, so I was kind of thinking if you could maybe help me out with something.
I need to create some sort of content, like maybe a blog or article or something
along those lines, about AI in healthcare, but not too technical...
```

Get this (75 tokens, 77% reduction):

```
Role: Professional content writer

Task: Write a blog post on AI in healthcare

Constraints:
- Tone: Professional and accessible (non-technical audience)
- Length: 800–1000 words

Key points:
- Challenges and risks (e.g., data privacy)
- Real-world examples and applications
- Include relevant statistics
- Provide a clear conclusion

Output requirements:
- Structured article with headings and sections
```

## How it works

### Quick Optimize (Free, local, instant)

A 3-layer pipeline that runs entirely in the browser:

**Layer 1 — Cleanup:** Removes filler words, soft language, verbose phrases, politeness fluff, greetings, and normalizes vague content descriptions.

**Layer 2 — Extract:** Pattern-matches to detect role, task, tone, length, audience, key points (with semantic signals like challenges/risks/statistics/conclusion), and output requirements (format, structure, inclusions).

**Layer 3 — Structure:** Assembles extracted components into a `Role / Task / Constraints / Key Points / Output Requirements` format. Includes quality gates (minimum extraction score to structure), deduplication (key points vs task, requirements vs key points), length guards (won't inflate short prompts), and acronym casing fixes.

Key features:
- **Role inference** — infers appropriate role from task context (11 domain mappings)
- **Compound tone detection** — "professional but not too boring" → "Professional and accessible"
- **Negated tone exclusion** — "not too technical" correctly excluded
- **Range detection** — "800 to 1000 words" → "800–1000 words"
- **Semantic key points** — detects challenges, examples, statistics, conclusion requests
- **Challenge example extraction** — "risks... like data privacy" → "Challenges and risks (e.g., data privacy)"

### Deep Optimize with AI (Optional, ~$0.001)

One LLM call (GPT-4o-mini) for semantic transformation when local rules aren't enough. Shows cost tradeoff:

```
Optimization cost:   $0.0003
Saved per future use: $0.0021
Break-even:          1 use
```

## Why hybrid?

Fully local = text formatter. Fully AI = spending tokens to save tokens blindly. The sweet spot: do the free stuff locally, use AI only when it adds real value — and **prove it with numbers**.

> "Optimization itself has a cost. The real skill is knowing when it's worth paying it."

## Tech stack

- React + Vite
- Zero dependencies beyond React
- OpenAI API (optional, for deep optimize only)

## Setup

```
npm install
npm run dev
```

No API key needed for local optimization. For AI optimization, enter your OpenAI API key in the app.

## Documentation

- [Optimizer Logic](docs/optimizer-logic.md) — full technical breakdown of the 3-layer pipeline
- [Test Cases](docs/test-cases.md) — test prompts with expected outputs and what each tests
