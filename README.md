# Offline Prompt Optimizer

AI is powerful — but most developers waste tokens before they get usable output.

Every retry costs money.

This tool fixes that.

Offline Prompt Optimizer transforms messy, conversational prompts into structured, token-efficient instructions — without calling any LLM APIs.

---

## Why this matters

- **Fewer retries** → lower cost  
- **Clearer prompts** → better outputs  
- **No API calls** → zero cost optimization  

> AI helps you get answers.  
> This tool helps you ask better questions.

## Where this fits

This tool is designed to be used before calling an LLM:

`Messy prompt` → `Optimize locally` → `Send to AI`

Instead of:
`Messy prompt` → `Retry` → `Retry` → `Retry`

It reduces the number of iterations needed to get useful output.

![From Messy to Masterful: Inside the Prompt Optimizer Engine](docs/internal-logic.png)

## Example

### Before
"Hey I was wondering if you could maybe help me write something about AI in healthcare..."

### After
```text
Role: Professional content writer

Task: Write a blog post on AI in healthcare

Constraints:
- Tone: Professional and accessible
- Length: 800–1000 words

Key Points:
- Real-world applications
- Benefits and risks
- Include statistics
```

### Before (Example 2)
"I need a short script that explains how DNS works, maybe like a YouTube short or TikTok style thing, target audience is normal people not engineers, keep it fun and use an analogy."

### After
```text
Role: Technical educator

Task: Write a short video script on how DNS works

Constraints:
- Tone: Conversational and engaging (non-technical audience)
- Platform: TikTok / YouTube Shorts

Key Points:
- Explain using a clear analogy (e.g., internet's phonebook)
- Emphasize speed and simplicity
```

## What changed?

- Removed conversational noise and filler language  
- Extracted intent (task, constraints, requirements)  
- Converted unstructured input into a structured prompt  

**Result:**
- Fewer tokens  
- More predictable outputs  
- Reduced need for retries  

This transformation reduces token usage and improves output consistency by removing ambiguity.

## How it works

1. **Removes conversational noise:** Strips out greetings, filler words, and soft language using local regex heuristics.
2. **Extracts intent:** Identifies tasks, constraints, tones, lengths, formatting constraints, and semantic key requirements.
3. **Structured format:** Reconstructs the input into a structured, role-based prompt.

All done locally — **no API calls required**. 

*(See the deep-dive technical logic in [Optimizer Logic](docs/optimizer-logic.md))*

## Why not just use AI?

LLMs *can* optimize prompts — but they cost tokens.

This tool lets you:
- Optimize locally **first**
- Use AI **only when necessary**

> Optimization itself has a cost. This tool helps you control it.

## Demo

Run locally and paste any messy prompt to see:
- Structured output  
- Token reduction  
- Exact changes applied  

## Tech stack & Setup

- React + Vite
- Client-side only (runs entirely in the browser)
- Optional OpenAI API integration for deep optimization

```bash
npm install
npm run dev
```

No API key needed for local optimization. For optional deep-AI optimization passes, enter your OpenAI API key directly in the app.

---
**Documentation**
- [Optimizer Architecture Breakdown](docs/optimizer-logic.md) 
- [Prompt Test Cases & Benchmarks](docs/test-cases.md)
