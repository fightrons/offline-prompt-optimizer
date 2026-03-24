# Evolution of the Prompt Optimizer

This document traces the architectural evolution of the optimizer from its initial MVP through the current signal-based interpretation engine.

---

## Phase 1: Rule-Based Cleaner (v0.1)

**Commit**: `d933e17` — *Initial commit: local prompt optimizer MVP*

The first version was a simple text cleaner. No structure detection, no intent awareness — just noise removal.

### Architecture

```
Input → Remove noise → Output (cleaned text)
```

### Capabilities

- Stripped politeness phrases ("please", "kindly", "would you mind")
- Removed hedging words ("maybe", "perhaps", "I think")
- Collapsed whitespace
- Basic verbose-to-concise substitutions ("in order to" → "to")

### Limitations

- No understanding of what the user wanted to do
- No structured output — just returned shorter text
- No role, task, or constraint detection
- Treated all prompts identically regardless of type

---

## Phase 2: 3-Layer Structuring Engine (v0.2)

**Commits**: `d3429fc` → `a932550`

The cleaner was extended into a structuring engine. Instead of just stripping noise, it extracted meaningful components and reassembled them into a structured prompt format.

### Architecture

```
Input
  ↓
Layer 1: Hard Cleanup       → Remove noise, normalize language
  ↓
Layer 2: Extract Components → Detect role, task, constraints, key points, output requirements
  ↓
Layer 3: Build Output       → Assemble structured prompt from extracted components
  ↓
Output: Role / Task / Constraints / Key Points / Output Requirements
```

### Key additions

- **Task extraction**: Regex patterns matching action verbs (write, create, analyze, debug) with priority ordering — earliest match wins
- **Role inference**: Keyword-to-role mapping (blog/article → content writer, debug/code → engineer)
- **Constraint detection**: Tone, word count, audience, language
- **Key point extraction**: Content patterns ("about X", "benefits of X") + semantic signals (challenges, examples, statistics)
- **Quality gate**: Only produce structured output if >= 2 components extracted; partial structure for task-only; passthrough for insufficient signal
- **Length guard**: Reject structured output if it exceeds original token count (prevents inflation of concise prompts)

### Limitations

- Only one output format — everything was forced into the Content template (Role/Task/Constraints/Key Points/Output)
- No intent detection — a spreadsheet workflow got the same treatment as a blog post request
- Rigid if/else detection chains — "analyze" always beat "write", regardless of context
- No way to separate background context from actual instructions

---

## Phase 3: Intent-Aware Branching (v0.3)

**Commits**: `d285e13` → `07979a6`

The system learned to distinguish between different types of prompts and route them to specialized extraction pipelines.

### Architecture

```
Input
  ↓
Layer 1: Hard Cleanup
  ↓
Layer 2: Classification
  ├── detectIntent()  → content | workflow | analysis | decision | generic
  └── detectDomain()  → product | frontend | backend | devops | finance | ...
  ↓
Layer 3: Intent-Specific Extraction
  ├── Content path    → extractRole, extractTask, extractConstraints, extractKeyPoints, extractOutputRequirements
  └── Workflow path   → extractWorkflowComponents (role, objective, context, topics, data sources, steps, output format, tools, guidelines)
  ↓
Layer 4: Build Output
  ├── Content format  → Role / Task / Constraints / Key Points / Output Requirements
  └── Workflow format → Role / Objective / Context / Topics / Inputs / Steps / Output Format / Tools / Guidelines
```

### Key additions

- **Intent detection**: If/else chain with hard priorities — decision keywords override analysis, which overrides workflow, which overrides content
- **Workflow scoring**: First use of signal scoring (6 signals, threshold of 2) — but only for the workflow category
- **Domain detection**: Hierarchical regex chain (product > frontend > backend > devops > finance > qa > software > ...)
- **Role × Domain mapping**: Two-dimensional lookup — intent and domain together determine the role
- **Intent-specific output formats**: Workflow prompts got a completely different format than content prompts
- **Pattern leakage prevention**: Builder-intent gating ("MVP"/"product" only inject builder constraints when explicitly building, not when prioritizing)

### Limitations

- Intent detection was a rigid priority chain — "analyze" anywhere in the text forced analysis intent, even in "Write an article analyzing..."
- Domain detection was first-match — "pipeline" always meant devops even in data pipeline contexts
- No execution intent — prompts about sending proposals, submitting applications had no dedicated path
- No context vs instruction separation — the entire prompt was treated as one unit

---

## Phase 4: Instruction Extraction Layer (v0.4)

**Commit**: `c815d57`

A dedicated layer was added to solve a critical problem: real-world prompts contain large amounts of background context with only a small portion of actual instructions.

### Key additions

- **`splitPrompt(text)`**: Detects instruction anchors ("Now I want you to...", "Your task is...") and splits the prompt into context + instructions
- **Instruction-priority extraction**: When an instruction block exists, task/steps/constraints are extracted ONLY from it — context cannot pollute task detection
- **Step extraction**: Detects numbered (`1.`, `1)`) , "Step N:" , and ordinal ("First, ...", "Second, ...") formats
- **Constraint extraction**: Detects "do not", "avoid", "must", "should", "keep" phrases — only from the instruction block
- **Execution intent detection**: Lightweight check for send/submit/proposal/outreach keywords

### Architecture change

This layer was additive — it didn't replace the existing pipeline, but provided new primitives that could be used by it.

---

## Phase 5: Signal-Based Scoring Engine (v0.5 — Current)

The largest architectural upgrade. Replaced rigid if/else detection chains with a signal-scoring engine that evaluates weighted patterns across all categories simultaneously.

### Architecture

```
Input
  ↓
Layer 1: Hard Cleanup           → Strip noise, normalize verbosity
  ↓
Layer 2: Intent Scoring         → Weighted signals across 5 intents → highest score wins
  ↓
Layer 3: Domain Scoring         → Weighted signals across 13 domains → highest score wins
  ↓
Layer 4: Instruction Detection  → Confidence-based context/instruction split
  ↓
Layer 5: Mode-Specific Extraction
  ├── Content path              → Sophisticated content.js extractors (role, task, constraints, key points, output requirements)
  ├── Workflow/Analysis/Decision → Structured workflow.js extractors (objective, context, topics, data sources, steps, output format, tools, guidelines)
  └── Execution path (NEW)      → Instruction-priority extraction (splitPrompt → extractTask → extractSteps → extractConstraints)
  ↓
Layer 6: Role Mapping           → intent × domain → role (5 intents × 13 domains matrix)
  ↓
Layer 7: Mode-Based Output Builder
  ├── Content   → Role / Task / Constraints
  ├── Workflow  → Role / Objective / Steps / Guidelines
  ├── Analysis  → Role / Objective / Focus Areas / Constraints
  ├── Decision  → Role / Objective / Evaluation Criteria / Expected Output
  └── Execution → Role / Objective / Steps / Constraints
```

### What changed from Phase 4

| Aspect | Phase 3-4 (Before) | Phase 5 (Now) |
|---|---|---|
| **Intent detection** | If/else chain with hard priorities. "analyze" always beat "write" | Weighted signal scoring. "Write an article analyzing..." → content wins (6 vs 3) |
| **Domain detection** | First-match regex chain. "pipeline" = always devops | Weighted signal scoring. "pipeline" scores low (1pt) in both workflow and devops — other signals decide |
| **Tiebreaking** | Implicit priority from if/else order | Explicit priority constants (decision > workflow > analysis > execution > content) |
| **Execution intent** | Not supported | Full pipeline: detect → split → extract → build |
| **Healthcare domain** | Not detected | Signal-scored with 5 patterns (patient, diagnosis, healthcare, hospital, health) |
| **HR domain** | Detected but limited | Signal-scored with 5 patterns (hiring, onboarding, hr, performance review, interview) |
| **Score transparency** | None — black box | Full score maps returned for intent, domain, and instruction confidence |
| **Output modes** | 2 (content, workflow) | 5 (content, workflow, analysis, decision, execution) |
| **Role matrix** | 5 intents × ~10 domains | 6 intents × 13 domains (including execution, healthcare, hr) |

### Why signal scoring matters

The old system suffered from **priority shadowing**: a single keyword could override the correct classification.

Example: *"Write a detailed blog post analyzing market trends in healthcare"*

- **Old system**: "analyze" triggers analysis intent → analysis path → wrong output format
- **New system**: content (write=3, blog=3, post=2 = 8) > analysis (analyzing=3, trends=2 = 5) → content wins correctly

Example: *"Set up a daily pipeline that scrapes RSS feeds and updates a Google Sheet with financial insights"*

- **Old system**: "insights" triggers analysis intent → analysis path → loses workflow structure
- **New system**: workflow (pipeline=1, scrape=2, rss=3, google sheet=3, daily=2 = 11) > analysis (insights=3 = 3) → workflow wins correctly

### Signal weight design

Weights 1-4 follow a specificity principle:

| Weight | Meaning | Examples |
|---|---|---|
| 1 | Ambiguous — appears across contexts | "create", "pipeline", "analytics" |
| 2 | Moderate — relevant but not definitive | "guide", "scrape", "trend" |
| 3 | Strong — clear category indicator | "write", "blog", "analyze", "prioritize" |
| 4 | Definitive — multi-word, category-unique | "impact vs effort", "evaluate options", "strategic plan" |

---

## Phase 6: Synthesis Layer (v0.6)

The synthesis layer was added between extraction and output building to solve a key limitation: raw extraction returns literal text from the prompt, but real-world instructions are noisy, numbered inconsistently, and need interpretation.

### Key additions

- **`synthesizeObjective(instructions, intent)`**: Generates intent-appropriate objectives instead of extracting raw sentences. Execution + proposal → "Identify relevant opportunities and create targeted proposals"
- **`normalizeSteps(sentences)`**: Maps raw action sentences to canonical phrasings via 20 pattern→canonical rules (e.g., "Open this page linkedin.com..." → "Access the target platform")
- **`dedupeSteps(steps)`**: Removes exact + semantic duplicates using 60% word overlap threshold
- **`synthesizeConstraints(instructions)`**: Strips numbering artifacts ("3 Do not..." → "Do not..."), deduplicates
- **`cleanInstructionText(text)`**: Strips numbering (1., 2.1, Step N:, bullets) before sentence analysis
- **`extractActionSentences(text)`**: Filters to action-verb sentences, rejects context/narrative

### Architecture change

Additive — sits between Layer 5 (extraction) and Layer 7 (output building):

```
Layer 5: Extraction → raw task, steps, constraints
  ↓
Synthesis Layer:
  cleanInstructionText → extractActionSentences → normalizeSteps → dedupeSteps
  synthesizeObjective (intent-aware)
  synthesizeConstraints (clean + dedupe)
  ↓
Layer 7: Output Builder → formatted output
```

---

## Phase 7: Specification Mode (v0.7)

**Commit**: `a3b8d1b`

The system failed on specification-style prompts (system design docs, feature specs). These contain explicit sections like Objective, Requirements, and Deliverables — but the pipeline was decomposing them into task/steps/constraints, destroying the intended structure.

### Key additions

- **`detectSections(text)`**: Detects 5 section types via markdown headers and bold labels
- **`classifyPromptType(text, intent)`**: Returns `"specification"` when Objective + Requirements + Deliverables all exist
- **`buildSpecification(text, positions, role)`**: Extracts and preserves existing section structure

---

## Phase 8: Data Preservation & Pipeline Refinement (v0.8 — Current)

The optimizer was too aggressive in its abstractions, losing critical information like URLs and background context (services, platform-specific details). Additionally, the sentence-splitting logic was fragile.

### Key additions

- **URL Preservation**: `normalizeSteps()` now extracts and appends URLs to canonical phrasings (e.g., "Access the target platform: https://...")
- **Context Preservation**: `execution` and `workflow` modes now include a `Context` block to ensure background data is not lost during extraction.
- **Robust Sentence Splitting**: Updated regex `/(?<=[.!?])(?!\d)\s+|\n+/` to handle decimal points (`1.5 min read`) without prematurely terminating sentences.
- **Pipeline Reordering**: `splitPrompt()` moved to **Layer 1.5** (before `hardCleanup`) to ensure instruction anchors like "I want you to" are detected before they are stripped.

### Architecture change

The pipeline order was refactored to ensure data integrity:
1. `splitPrompt()` on raw text
2. `hardCleanup()` on context and instructions separately
3. Intent/Domain classification on cleaned text

---

## Module Map (Current)

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

---

## Future Considerations: Local LLM Optimization via WebGPU

### Motivation

The current local optimizer is a heuristic pipeline — fast and deterministic, but fundamentally limited to pattern matching. An in-browser LLM could produce genuinely restructured prompts at GPT-level quality, completely free and offline-capable, with no API keys required.

### Candidate: web-llm (mlc-ai/web-llm)

[web-llm](https://github.com/mlc-ai/web-llm) runs quantized LLMs entirely in the browser via WebGPU. The API is OpenAI-compatible (`chat.completions.create`), which maps directly to our existing `ai.js` system prompt and message format. Models are downloaded once and cached in the browser — all subsequent inference is fully offline.

### Model options (smallest to largest)

| Model | Download Size | Notes |
|-------|--------------|-------|
| SmolLM2-360M-Instruct | ~200MB | Likely too weak for reliable instruction following |
| Qwen3-0.6B | ~400MB | Better instruction following, reasonable starting point |
| SmolLM2-1.7B-Instruct | ~1GB | Good balance — noticeably better at structured tasks |
| Phi-3.5-mini (3.8B) | ~2.2GB | Excellent instruction following, but large download |

**Recommendation**: Start with Qwen3-0.6B. If output quality is insufficient, step up to SmolLM2-1.7B.

### Integration approach

- Use `CreateWebWorkerMLCEngine` to run inference off the main thread (no UI blocking)
- Reuse the existing system prompt from `ai.js`
- Gate behind `navigator.gpu` check — fall back to heuristic optimizer when WebGPU is unavailable
- Show a progress bar during first-time model download
- Keep the heuristic pipeline as instant fallback (no WebGPU, first visit, unsupported browsers)

### Open questions

1. **Quality**: Can a 0.6–1.7B model reliably follow the structured output format (Role/Task/Constraints/etc.) without hallucinating sections or drifting?
2. **UX**: Is a 200MB–1GB first-visit download acceptable for the target audience?
3. **Browser support**: WebGPU requires Chrome/Edge 113+. No Firefox stable, limited Safari. Is this acceptable or does it narrow the audience too much?
4. **Coexistence**: Should this replace the heuristic optimizer entirely, or exist as a third optimization tier ("Local AI")?

### Validation plan

Before committing to integration, run the existing system prompt through the candidate models on representative sample prompts and compare output quality against the heuristic pipeline results.

---

## Test Coverage Evolution

| Phase | Tests | What they cover |
|---|---|---|
| Phase 1 | 0 | Manual testing only |
| Phase 2 | ~20 | Basic cleanup + structure extraction |
| Phase 3 | 80 | 7 content tests + 1 workflow test + leakage prevention |
| Phase 4 | 133 | + 34 instruction extraction tests + 2 intent-alignment tests |
| Phase 5 | 187 | + 54 scoring/engine/builder tests + execution mode |
| Phase 6 | 242 | + 55 synthesis tests (objective, step normalization, constraints) |
| Phase 7 | 276 | + 34 specification tests (section detection, classification, builder, integration) |
