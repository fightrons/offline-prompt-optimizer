# Optimizer Logic — How the Local Engine Works

The local optimizer transforms unstructured, conversational prompts into structured, token-efficient prompts using a 3-layer pipeline. No API calls, no ML models — pure pattern matching and rule-based transformation.

## Architecture Overview

```
User Input (messy, conversational)
        │
        ▼
┌─────────────────────┐
│  Layer 1: Cleanup   │  Remove noise, normalize language
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Layer 2: Extract   │  Detect role, task, constraints, key points, output requirements
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Layer 3: Build     │  Assemble structured prompt from extracted components
└────────┬────────────┘
         │
         ▼
  Structured Output (Role / Task / Constraints / Key Points / Output)
```

## Layer 1: Hard Cleanup

Runs four rule sets in order. Each set is an array of regex patterns applied sequentially.

### 1a. Task Normalization

Converts vague content descriptions into clear format names **before** other cleanup runs.

| Input Pattern | Output |
|---|---|
| "create some sort of content, like maybe a blog or article or something along those lines" | "write a blog post" |
| "if that makes sense" | *(removed)* |
| "yeah", "I guess", "pretty much" | *(removed)* |
| "or something like that" | *(removed)* |
| "if possible", "if you can" | *(removed)* |
| "I'm not super strict about..." | *(removed)* |

**Why first?** These normalizations must run before soft language removal, otherwise patterns like "maybe a blog" get partially stripped and become unmatchable.

### 1b. Verbose-to-Concise Replacement

38 phrase-level substitutions that replace wordy constructions with concise equivalents.

| Verbose | Concise |
|---|---|
| "in order to" | "to" |
| "due to the fact that" | "because" |
| "for the purpose of" | "to" |
| "the majority of" | "most" |
| "has the ability to" | "can" |
| "take into consideration" | "consider" |
| "provide a summary of" | "summarize" |
| "it is important to note that" | *(removed)* |

### 1c. Soft Language Removal

Strips words and phrases that add politeness or hedging but zero information for an LLM.

**Categories:**
- **Politeness**: please, kindly, would you mind, I would appreciate
- **Hedging**: maybe, perhaps, I think, I believe, sort of, kind of
- **Filler**: just, really, very, actually, basically, honestly, frankly
- **Greetings/closings**: hello, hi, hey, thank you, thanks
- **Imperative conversion**: "Can you..." / "Could you..." at line start → removed (makes instruction direct)

### 1d. Redundant Instruction Patterns

Removes meta-instructions that tell the LLM to do what it would do anyway.

- "make sure that you..."
- "please note that"
- "keep in mind that"
- "don't forget to"
- "also," (transition word adding no content)

### 1e. Whitespace Collapse

After all regex runs, the text is cleaned:
- Multiple spaces/tabs → single space
- 3+ newlines → double newline
- Leading/trailing spaces on lines → stripped
- Double periods (`..`) → single period
- Double commas → single comma
- Spaces before punctuation → removed

## Layer 2: Extract Structured Components

Runs against both the original input and the cleaned text, depending on what's being extracted. Constraints use the original (to catch tone/length before they're stripped). Task and key points use the cleaned text (to avoid matching noise).

### 2a. Role Extraction

**Explicit role** — regex matches phrases like "you are a [role]", "act as a [role]". Only matches if the captured text ends with a known role noun (writer, engineer, developer, analyst, etc.) to avoid false positives like "you are about to..." capturing garbage.

**Inferred role** — if no explicit role is found, the task text is matched against keyword→role mappings:

| Task Keywords | Inferred Role |
|---|---|
| blog, article, write, content | Professional content writer |
| code, debug, refactor, API, bug | Senior software engineer |
| explain, teach, tutorial | Technical educator |
| analyze, data, report, metrics | Data analyst |
| design, UI, UX, wireframe | UX/UI designer |
| market, brand, campaign, SEO | Marketing strategist |
| email, letter, message | Professional communicator |
| plan, strategy, roadmap | Strategic planner |
| translate, localize | Professional translator |
| summarize, summary, overview | Research analyst |
| *(fallback)* | Domain expert |

### 2b. Task Extraction

Three regex pattern groups scan for action verbs, each covering a different verb family:

1. **Creation**: write, create, build, generate, design, develop, draft, compose, produce, prepare
2. **Analysis**: explain, describe, summarize, analyze, review, compare, evaluate, list, outline
3. **Transformation**: translate, convert, transform, rewrite, edit, fix, debug, refactor, optimize

**Earliest match wins.** All three pattern groups are tested, and the match with the lowest index in the text is selected. This prevents later verbs from shadowing earlier, more relevant ones (e.g., "debug" appearing before "explain").

**Object cleanup:** The captured object after the verb is aggressively trimmed — trailing conjunctions, noise phrases, and subordinate clauses are stripped.

**Topic enrichment:** After extracting the core verb+object, the full text is scanned for an "about/on/regarding" clause. If found and not already present in the task, it's appended (e.g., "Write a blog post" + "about AI in healthcare" → "Write a blog post on AI in healthcare").

**Fallback:** If no verb pattern matches, the first meaningful sentence (>10 chars) is used as the task.

### 2c. Constraint Extraction

Runs against the **original input** to catch signals before cleanup strips them.

**Tone detection:**
- Scans for tone words: professional, casual, formal, friendly, simple, academic, conversational, humorous, serious, persuasive, informative
- **Negated tones are excluded**: "not too technical" does NOT add "Technical"
- **Compound tones**: multiple detected tones are joined with "and"
- **Accessibility signals**: patterns like "not too technical", "easy to understand", "non-technical", "simple language" trigger an "accessible (non-technical audience)" suffix

**Length detection:**
- **Range**: "800 to 1000 words" → "800–1000 words" (uses en-dash)
- **Approximate**: "around 500 words" → "~500 words"
- **Maximum**: "under 200 words" → "~200 words"

**Language and audience** are also extracted via pattern matching if present.

### 2d. Key Point Extraction

Two-phase approach:

**Phase 1 — Content pattern matching.** Scans sentences for phrases like "about X", "benefits of X", "cover X". Extracted points are:
- Trimmed of trailing conjunctions
- Run through clarity compression ("because it provides flexibility" → "Flexibility as a key driver")
- Filtered: must be 2+ words, 6–150 chars, no duplicates

**Phase 2 — Semantic signal detection.** Scans the full text for topic-level signals regardless of sentence structure:

| Signal | Key Point Generated |
|---|---|
| challenges, risks, concerns, limitations | "Challenges and risks" (with e.g. if concrete example found nearby) |
| real-world examples, practical applications | "Real-world examples and applications" |
| how [someone] is using/leveraging | "Real-world examples and applications" |
| statistics, stats, data, figures | "Include relevant statistics" |
| conclusion, summary, wrap up | "Provide a clear conclusion" |

**Challenge example extraction**: When challenges/risks are detected, the system searches for concrete examples in nearby text (same sentence or next sentence). It tries three patterns in order:
1. Same-sentence "like/such as [X]"
2. Cross-sentence "like/such as [X]"
3. Direct keyword match (data privacy, bias, security, etc.)

Each candidate is validated — noise words ("perfect", "anything", "something") cause the candidate to be skipped, and the loop continues to the next pattern.

**Deduplication**: After both phases, content-pattern entries that overlap with semantic entries are removed. Overlap is measured by word intersection ratio (>= 40% overlap = duplicate). Semantic entries always take priority.

### 2e. Output Requirement Extraction

Detects formatting and structural requirements:

- **Format patterns**: bullet points, numbered lists, JSON, Markdown, tables, code examples
- **Content inclusions**: "include statistics/examples/references/diagrams" etc.
- **Specific list requests**: "list of tips for [X]", "steps to [Y]"
- **Structure detection**: "headings", "sections", "easy to read", "structured article" → "Structured article with headings and sections"

## Layer 3: Build Structured Prompt

### Quality Gate

Before assembling, a structure score is calculated:

```
score = (task ? 1 : 0)
      + (constraints.length > 0 ? 1 : 0)
      + (key points.length > 0 ? 1 : 0)
      + (output requirements.length > 0 ? 1 : 0)
```

| Score | Action |
|---|---|
| >= 2 | Full structured output (Role/Task/Constraints/Key Points/Output) |
| 1 (task only) | Partial structure (Role + Task) |
| 0 | Return cleaned text as-is |

### Deduplication Pipeline

Before assembly, three deduplication passes run:

1. **Key points vs task**: If 60%+ of a key point's significant words appear in the task, the point is dropped (it's redundant)
2. **Output requirements vs key points**: If 50%+ of a requirement's significant words appear in any key point, the requirement is dropped
3. **Content patterns vs semantic signals**: Handled inside key point extraction (described above)

### Length Guard

After assembly, if the structured output has **more tokens than the original input**, it falls back:
1. First fallback: use cleaned text (layer 1 output only)
2. Second fallback: if cleaned text is also longer, return the original input unchanged

This prevents short, already-concise prompts from being inflated with structure.

### Acronym Casing

Final pass fixes common acronym casing: ai→AI, api→API, ml→ML, sql→SQL, html→HTML, json→JSON, etc.

## Token Estimation

Uses `js-tiktoken` with the `gpt-4o-mini` encoding for model-accurate token counts. The encoder is lazy-loaded via dynamic `import()` to keep the main bundle small (~215KB), with a `words × 1.3` heuristic fallback during the brief async load window.

## Cost Estimation (AI mode only)

When the optional AI deep optimize is used, cost is calculated from GPT-4o-mini pricing:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Break-even = optimization cost / savings per future use

## Local vs AI — Independent Paths

The local and AI optimization paths are intentionally kept independent. They do NOT chain (AI does not receive local output as input by default).

**Why separate?** Chaining would defeat the purpose — the AI should demonstrate its own ability to parse messy prompts, not just polish pre-structured output. The two paths serve different use cases:

- **Local**: Free, instant, deterministic. Uses rule-based regex patterns with domain-priority role inference (e.g., DevOps keywords override content verbs).
- **AI**: Costs tokens, non-deterministic. Uses GPT-4o-mini with a structured system prompt that includes role inference guidance.

**The role inference problem:** A prompt like "Write a guide about setting up CI/CD pipelines" can be interpreted as content writing (verb = "write") or DevOps (topic = CI/CD). The local engine handles this with explicit priority ordering — DevOps keywords are checked before content verbs. The AI system prompt includes a rule nudging the model to infer roles from topic domain, not just the verb:

> *"Infer the Role from the topic domain, not just the verb. 'Write a guide about CI/CD' needs a DevOps engineer, not a content writer."*

If the user runs Quick Optimize first, then clicks Deep Optimize, the AI receives the local output (already structured). If they click Deep Optimize directly, the AI receives the raw input. Both paths are valid.
