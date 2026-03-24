# Optimizer Logic — How the Local Engine Works

The local optimizer transforms unstructured, conversational prompts into structured, token-efficient prompts using a **7-layer signal-based pipeline**. No API calls, no ML models — weighted pattern matching and rule-based transformation.

## Architecture Overview

```
User Input (messy, conversational)
        │
        ▼
┌─────────────────────────────────┐
│  Layer 1: Hard Cleanup          │  Strip noise, normalize verbosity
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 2: Intent Scoring        │  Weighted signals across 5 intents → highest score wins
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 3: Domain Scoring        │  Weighted signals across 13 domains → highest score wins
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 3.5: Type Classification │  Specification detection (early exit if spec)
└────────┬────────────────────────┘
         │
         ├── Specification → preserve structure, skip extraction/synthesis
         │
         ▼ (non-spec only)
┌─────────────────────────────────┐
│  Layer 4: Instruction Detection │  Confidence-based context/instruction split
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 5: Extraction            │  Task, steps, constraints (instruction-priority)
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 6: Role Mapping          │  intent × domain → role (5 intents × 13 domains)
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Layer 7: Mode-Based Builder    │  5 output formats matched to intent
└────────┬────────────────────────┘
         │
         ▼
  Structured Output
        │
        ├── Specification → Role / Objective / Requirements / Deliverables / Constraints
        ├── Content       → Role / Task / Constraints
        ├── Workflow      → Role / Objective / Steps / Guidelines
        ├── Analysis      → Role / Objective / Focus Areas / Constraints
        ├── Decision      → Role / Objective / Evaluation Criteria / Expected Output
        └── Execution     → Role / Objective / Steps / Constraints
```

---

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

---

## Layer 2: Intent Scoring

Replaces the old if/else detection chain with **weighted signal scoring**. All 5 intent categories are scored simultaneously against the text; the highest score wins.

### Signal Weight Scale (1–4)

| Weight | Meaning | Examples |
|---|---|---|
| 1 | Ambiguous — appears across contexts | "create", "pipeline", "summarize" |
| 2 | Moderate — relevant but not definitive | "guide", "scrape", "trend", "generate" |
| 3 | Strong — clear category indicator | "write", "blog", "analyze", "prioritize", "send" |
| 4 | Definitive — multi-word, category-unique | "impact vs effort", "evaluate options", "strategic plan" |

### Intent Signal Categories

**Content** (writing/creation):
- Weight 3: write, draft, compose, blog, article, essay
- Weight 2: guide, tutorial, how-to guide, generate, produce, post, copy, headline
- Weight 1: create, summarize, explain, describe

**Workflow** (multi-step processes):
- Weight 3: spreadsheet, excel sheet, google sheet, column [a-z], rss, xml feed
- Weight 2: step N, scrape, fetch, crawl, update rows, daily basis, weekly task, recurring, automate
- Weight 1: pipeline

**Analysis** (data analysis/insight):
- Weight 3: analyze, analyzing, insights, data analysis, statistical
- Weight 2: trends, correlation, regression, findings
- Weight 1: patterns

**Decision** (strategic evaluation):
- Weight 4: impact...effort, evaluate options, strategic plan, what to build next
- Weight 3: prioritize, prioritization, roadmap, trade-offs

**Execution** (action-oriented):
- Weight 3: send, dispatch, submit, proposals, outreach
- Weight 2: apply, applying, deliver, distribute, forward, escalate

### Tiebreaking

When two intents tie, explicit priority ordering decides:
```
decision (5) > workflow (4) > analysis (3) > execution (2) > content (1)
```

### Why Signal Scoring Matters

The old system suffered from **priority shadowing**: a single keyword could override the correct classification.

Example: *"Write a detailed blog post analyzing market trends in healthcare"*
- **Old system**: "analyze" triggers analysis intent → wrong output format
- **New system**: content (write=3, blog=3, post=2 = 8) > analysis (analyzing=3, trends=2 = 5) → content wins correctly

Example: *"Set up a daily pipeline that scrapes RSS feeds and updates a Google Sheet with financial insights"*
- **Old system**: "insights" triggers analysis → loses workflow structure
- **New system**: workflow (pipeline=1, scrape=2, rss=3, google sheet=3, daily=2 = 11) > analysis (insights=3 = 3) → workflow wins correctly

---

## Layer 3: Domain Scoring

Uses the same signal-scoring approach as intent. Scores text against 13 domain categories simultaneously.

URLs are stripped before scoring to avoid false positives from link text.

### Supported Domains

| Domain | Key Signals (weight 3+) |
|---|---|
| product | product manager, PM role (4), feature request, backlog, user stories, stakeholder, MVP |
| frontend | react, vue, angular, svelte, css, html, tailwind, frontend |
| backend | node, express, django, flask, fastapi, graphql, rest api, backend |
| devops | docker, kubernetes, k8s, ci/cd, jenkins, github actions, devops |
| finance | revenue, profit, margin, financial, fiscal, quarterly, roi, p&l, balance sheet |
| qa | qa, quality assurance, unit test, integration test, e2e |
| software | system design, refactor |
| design | figma, sketch, wireframe, prototype, user experience, ux |
| education | student, curriculum, education |
| marketing | seo, sem, funnel, leads, conversion |
| healthcare | patient, diagnosis, treatment, healthcare, medical, clinical |
| hr | hiring, recruit, talent, onboarding, employee, workforce, performance review, hr (4), human resources (4) |

Fallback: `general` when all scores are 0.

---

## Layer 3.5: Type Classification

After intent and domain scoring, the pipeline checks whether the prompt is a **specification** — a structured document with explicit section headers.

### Why a separate type?

Specification prompts (system design docs, feature specs, implementation briefs) declare their structure explicitly with headers like `## Objective`, `## Requirements`, `## Deliverables`. The normal pipeline would decompose these into task/steps/constraints, losing the author's intended structure. Specifications must be **preserved**, not synthesized.

### Detection

`classifyPromptType(text, intent)` runs `detectSections()` against the **raw text** (before cleanup, to preserve markdown headers). It checks for 5 section types:

| Section | Header Patterns |
|---|---|
| objective | `## Objective`, `**Objective**:`, `Objective:` |
| requirements | `## Requirements`, `**Requirements**:`, `Requirements:` |
| deliverables | `## Deliverables`, `**Deliverables**:`, `Deliverables:` |
| steps | `## Steps`, `**Steps**:`, `Steps:` |
| constraints | `## Constraints`, `## Important`, `Constraints:` |

### Classification Rule

**All three** core sections must be present: Objective + Requirements + Deliverables → `"specification"`.

Having only two of three is NOT enough — it could be a structured workflow or analysis prompt. This strict gate prevents false positives.

### Early Exit

When classified as specification, the pipeline takes an early exit:
1. Role is mapped normally (intent × domain)
2. Sections are extracted and lightly cleaned (not synthesized)
3. Output preserves the spec structure: Role / Objective / Requirements / Deliverables / Constraints
4. Layers 4–7 (instruction detection, extraction, synthesis, mode builder) are **skipped entirely**

### Specification Output Format

```
Role: [role]

Objective: [single statement from objective section]

Requirements:
- [requirement 1]
- [requirement 2]

Deliverables:
1. [deliverable 1]
2. [deliverable 2]

Constraints:
- [constraint 1]
```

Requirements and constraints use bullet lists; deliverables use numbered lists. Content is cleaned lightly (strip markdown headers, normalize whitespace) but NOT rewritten.

---

## Layer 4: Instruction Detection

Real-world prompts often contain large blocks of background context with instructions buried at the end. This layer separates them.

### Context/Instruction Splitting

**Critical design**: `splitPrompt()` runs on the **raw text** (before cleanup) to preserve instruction anchors like "I want you to" that `hardCleanup` would strip. Each portion is cleaned separately afterward.

**Instruction anchors** (14 patterns):
- "Now I want you to...", "Your task is...", "Follow these steps..."
- "Do the following...", "You need to...", "I need you to..."
- "Instructions:", "Task:", "Requirements:"

When an anchor is found, the text is split into:
- **Context** — everything before the earliest anchor
- **Instructions** — everything from the anchor onward

When no anchor is found, the entire text is treated as context (fallback mode).

### Instruction Confidence Score

A parallel scoring pass computes a confidence value (0–1) indicating how instruction-heavy the prompt is overall:

- **Strong signals** (weight 5): instruction anchors
- **Moderate signals** (weight 3–4): numbered steps, "you need to", "task:", "requirements:"
- **Weak signals** (weight 1–2): constraint phrases (must, avoid, should), imperative verbs at line start

Threshold: 0.12 (normalized score = raw / max possible). Max possible (~56) is never fully achievable since signals are mutually exclusive in practice.

---

## Layer 5: Mode-Specific Extraction

When instructions exist, extraction happens **only from the instruction block**. Context cannot pollute task detection — this is the core principle.

### Task Extraction

Uses a scoring system to pick the best sentence from the instruction block:

| Signal | Score Modifier |
|---|---|
| Contains instruction anchor phrase | +20 |
| Positional bonus (earlier = better) | +5 minus sentence index |
| Contains action verb (send, create, analyze...) | +3 |
| Is a numbered step (1., 2.) | -15 |
| Contains context-like phrases ("for example", "case study") | -5 to -8 |

Instruction anchor prefixes ("Your task is to", "I want you to") are stripped from the final task.

When no instruction block exists, task extraction falls back to the full text.

### Step Extraction

Detects four step formats:
1. **Numbered with dot**: `1. Open the file`
2. **Numbered with paren**: `1) Filter the data`
3. **Step N: format**: `Step 1: Collect data` (uses lookahead to handle single-line lists)
4. **Ordinal**: `First, review...`, `Second, highlight...`, `Finally, submit...`

Inline numbered items are also handled via regex: `1. do A 2. do B 3. do C` on a single line.

### Constraint Extraction

Matches constraint-signaling phrases from the instruction block only:
- **Prohibitions**: do not, don't, avoid, never, exclude
- **Requirements**: must, should, ensure, only, limit, stick to, within
- **Boundaries**: keep [X] under/below/within

---

## Layer 6: Role Mapping

Maps `intent × domain` to a professional role using a 2D lookup.

### Engineering Domain Overrides

Three domains always override intent because they are highly specialized:
- `devops` → "DevOps engineer"
- `frontend` → "Frontend developer"
- `backend` → "Backend engineer"

### Intent × Domain Matrix (excerpt)

| Domain | Content | Workflow | Analysis | Decision | Execution |
|---|---|---|---|---|---|
| product | Content writer | Workflow automation | Product Manager | Product Manager | Product Ops Manager |
| finance | Content writer | Financial Ops Specialist | Financial analyst | Financial Controller | Financial Ops Analyst |
| marketing | Content writer | Content research specialist | Marketing analyst | Marketing strategist | Business Dev Specialist |
| software | Senior SW engineer | Senior SW engineer | Senior SW engineer | Engineering Manager | Software Engineer |
| healthcare | Medical Content Writer | Clinical Workflow Specialist | Healthcare Data Analyst | Healthcare Ops Director | Healthcare Ops Coordinator |
| hr | Content writer | HR Ops Specialist | Talent Analyst | HR Director | HR Ops Specialist |
| general | Content writer | Workflow automation | Data analyst | Strategic planner | Operations Specialist |

Generic intent (no clear signal) falls back to domain-based roles: software → Senior SW engineer, design → UX/UI designer, etc. Final fallback: "Domain expert".

---

## Layer 7: Mode-Based Output Builder

Each intent maps to a dedicated output format with mode-appropriate section labels.

### Content Mode
```
Role: [role]

Task: [task]

Constraints:
- [constraint 1]
- [constraint 2]
```

### Workflow Mode
```
Role: [role]

Objective: [task]

Steps:
1. [step 1]
2. [step 2]

Guidelines:
- [constraint 1]
```

### Analysis Mode
```
Role: [role]

Objective: [task]

Focus areas:
- [step/topic 1]
- [step/topic 2]

Constraints:
- [constraint 1]
```

### Decision Mode
```
Role: [role]

Objective: [task]

Evaluation criteria:
- [criteria from constraints + evaluation-style steps]

Expected output:
- [action-style steps]
```

**Decision heuristic**: Steps containing keywords like "impact", "criteria", "evaluate", "prioritize", "rank" are classified as evaluation criteria. Other steps become expected output items.

### Execution Mode
```
Role: [role]

Objective: [task]

Steps:
1. [step 1]
2. [step 2]

Constraints:
- [constraint 1]
```

### Quality Gate

Before building, a signal strength score is calculated:
```
signalStrength = (task ? 1 : 0) + (steps.length > 0 ? 1 : 0) + (constraints.length > 0 ? 1 : 0)
```

If signalStrength >= 1, structured output is produced. Otherwise, the cleaned text (Layer 1 output) is returned as-is.

### Acronym Casing

Final pass fixes common acronym casing: ai→AI, api→API, ml→ML, sql→SQL, html→HTML, json→JSON, etc.

---

## Synthesis Layer

Sits between extraction (Layer 5) and output building (Layer 7). Unlike extraction which pulls raw text, synthesis **interprets** intent, groups actions, removes noise, and generates clean structured output.

### Why Synthesis?

Raw extraction returns whatever text was in the prompt. For a prompt like:

> *"1. Open this page https://linkedin.com/... 2. Understand the services which we provide and only send proposals to relevant services 3. Once you write the cover letter, share it with me for approval..."*

Raw extraction returns verbose, literal steps. Synthesis normalizes them to:

1. Access the target platform
2. Assess service relevance
3. Draft a targeted proposal
4. Share for approval
5. Submit final output

### Pipeline

```
Raw instructions
  → cleanInstructionText()      Strip numbering (1., 2.1, Step N:, bullets)
  → synthesizeObjective()       Intent-aware objective generation
  → extractActionSentences()    Filter to action-verb sentences only
  → normalizeSteps()            Map to canonical phrasings (20 pattern rules)
  → dedupeSteps()               Remove exact + semantic duplicates (60% overlap)
  → synthesizeConstraints()     Extract, clean numbering artifacts, deduplicate
  → { objective, steps, constraints }
```

### Objective Synthesis

Instead of extracting a raw sentence, `synthesizeObjective(instructions, intent)` generates intent-appropriate objectives:

| Intent | Signal | Synthesized Objective |
|---|---|---|
| execution | proposal + linkedin/send | "Identify relevant opportunities and create targeted proposals" |
| execution | apply/application | "Prepare and submit a targeted application" |
| execution | deliver/distribute | "Prepare and deliver output to target recipients" |
| analysis | financial/revenue | "Analyze financial data to extract actionable insights and patterns" |
| analysis | market/competitor | "Analyze market data to identify trends and opportunities" |
| decision | roadmap/what to build | "Evaluate inputs and prioritize initiatives based on impact and feasibility" |
| workflow | rss/scrape/crawl | "Execute a structured workflow to collect and organize information" |
| content | *(any)* | Falls through to extracted task (no synthesis needed) |

### Step Normalization

Maps messy real-world instructions to clean canonical steps via a prioritized pattern map:

| Raw Pattern | Canonical Step |
|---|---|
| open/visit/navigate + page/site/portal | "Access the target platform" |
| review/check + input/requirement/request | "Review input requirements" |
| filter/select/pick + relevant/matching | "Filter for relevant items" |
| write/draft/compose + cover letter/proposal | "Draft a targeted proposal" |
| share/present + approval/review | "Share for approval" |
| submit/send/deliver + final/approved | "Submit final output" |
| analyze + data/trend/metric | "Analyze data for patterns and insights" |
| prioritize/rank + impact/effort | "Prioritize by impact and feasibility" |

Sentences that don't match any pattern are kept with minimal cleanup (strip leading conjunctions, capitalize).

### Constraint Synthesis

Goes beyond raw extraction:
- Strips numbering artifacts ("3 Do not..." → "Do not...")
- Normalizes capitalization
- Deduplicates by semantic word overlap (60% threshold)

---

## Content Path (via `index.js`)

The main `optimizeLocal()` function in `index.js` maintains the original content and workflow extraction paths for prompts routed through that entry point:

- **Content path**: Extracts role (explicit or inferred), task, constraints (tone, length, audience), key points (content patterns + semantic signals), and output requirements. Uses a quality gate (score >= 2 for full structure) and a **length guard** that rejects structured output if it exceeds the original token count.

- **Workflow path**: Extracts objective, context, topics, data sources, steps, output format, tools, and guidelines. Uses a relaxed length guard (15% expansion allowed since structure adds value).

- **Execution path**: Uses the instruction extraction layer — `splitPrompt` → `extractTask` → `extractSteps` → `extractConstraints` → `buildModeOutput('execution', ...)`. Skips the length guard (execution prompts need structure regardless of length).

The `engine.js` interpret function provides a unified entry point that routes all intents through the same signal-based pipeline.

---

## Score Transparency

Both `scoreIntent()` and `scoreDomain()` return full score maps alongside the winner:

```javascript
{
  winner: 'workflow',
  score: 11,
  confidence: 0.73,   // winner's score / total signal mass
  scores: {
    content: 2,
    workflow: 11,
    analysis: 3,
    decision: 0,
    execution: 0
  }
}
```

This makes the scoring engine fully inspectable — no black-box decisions.

---

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

- **Local**: Free, instant, deterministic. Uses signal-based scoring with weighted pattern matching and instruction-priority extraction.
- **AI**: Costs tokens, non-deterministic. Uses GPT-4o-mini with a structured system prompt that includes role inference guidance.

If the user runs Quick Optimize first, then clicks Deep Optimize, the AI receives the local output (already structured). If they click Deep Optimize directly, the AI receives the raw input. Both paths are valid.

---

## Module Map

```
src/optimizer/
├── index.js              Main pipeline orchestrator (optimizeLocal)
├── scoring.js            Signal definitions + generic scoring engine
├── builder.js            Mode-based output builder (5 modes)
├── engine.js             Standalone interpretation pipeline (with spec early exit)
├── classifier.js         Prompt type classification (specification vs intent)
├── specBuilder.js        Specification builder (structure-preserving)
├── synthesis.js          Controlled synthesis: objective, step normalization, constraint cleaning
├── utils.js              hardCleanup, compressClarity, fixCasing
├── tokens.js             Tiktoken + Anthropic token counting
├── patterns.js           SOFT_LANGUAGE, VERBOSE_TO_CONCISE, TASK_NORMALIZATIONS
├── ai.js                 OpenAI integration (gpt-4o-mini)
└── extractors/
    ├── intent.js         → delegates to scoring.js scoreIntent()
    ├── domain.js         → delegates to scoring.js scoreDomain()
    ├── role.js           Intent × Domain → Role mapping (5×13 matrix)
    ├── sections.js       Section detection for specification prompts (5 section types)
    ├── content.js        Sophisticated content extraction (~650 lines)
    ├── workflow.js       Workflow/analysis/decision extraction (~260 lines)
    └── instructions.js   Context/instruction separation + instruction-priority extraction

src/__tests__/
├── optimizer.test.js      99 tests — full pipeline regression suite
├── engine.test.js         54 tests — scoring, builder, engine, edge cases
├── instructions.test.js   34 tests — instruction extraction layer
├── synthesis.test.js      55 tests — synthesis layer (objective, steps, constraints)
└── specification.test.js  34 tests — specification detection, classification, builder, integration
```

Total: **276 tests** across 5 test files.
