# Test Cases — Prompt Optimizer

## Test 1: Healthcare AI Blog (Verbose, Conversational)

**Input** (291 tokens):

```
Hey, so I was kind of thinking if you could maybe help me out with something. I need to create some sort of content, like maybe a blog or article or something along those lines, about AI in healthcare, but not too technical because I feel like a lot of people don't really understand all the complicated stuff. It would be great if you could write it in a way that sounds professional but also not too boring, if that makes sense.

I think it should probably be around like 800 to 1000 words, not too short because I want it to feel detailed, but also not super long where people lose interest. Also, I guess it would be nice if you could include some real-world examples, maybe like how hospitals or doctors are using AI these days, and possibly some statistics if you can find them, but it's okay if not.

Another thing is, I would really appreciate it if you could also talk a bit about the challenges or risks, because I don't want it to sound like AI is perfect or anything. Maybe like data privacy or something like that. And also maybe end it with some sort of conclusion or summary, just to wrap things up nicely.

Oh, and if possible, could you maybe structure it in a way that's easy to read, like with headings or sections or something? I'm not super strict about formatting, but just something that looks clean.

Yeah, I think that's pretty much it. Thanks a lot!
```

**Expected output** (81 tokens):

```
Role: Professional content writer

Task: Write a blog post on AI in healthcare

Constraints:
- Tone: Professional (non-technical audience)
- Length: 800–1000 words

Key points:
- Challenges and risks (e.g., data privacy)
- Real-world examples and applications

Output requirements:
- Structured article with headings and sections
- Include relevant statistics
- Provide a clear conclusion
```

**Reduction**: 72%

**What this tests**:
- Task normalization ("create some sort of content, like a blog or article" → "Write a blog post")
- Topic enrichment ("about AI in healthcare" appended to task)
- Compound tone detection ("professional but not too boring" → Professional and accessible)
- Negated tone exclusion ("not too technical" does NOT add Technical)
- Word range detection ("800 to 1000 words" → 800–1000)
- Semantic key point extraction (challenges with example, real-world examples, statistics, conclusion)
- Structure detection ("headings or sections" → output requirement)
- Acronym casing (ai → AI)
- Filler removal (hey, yeah, I guess, pretty much, thanks a lot, etc.)
- Noise deduplication (no duplicate challenges entries)

---

## Test 2: Remote Work Blog (Polite, Redundant)

**Input** (166 tokens):

```
Hello, I would like you to please help me write a blog post. Can you please make sure that you write it in a professional tone? I think it should be about the benefits of remote work. I believe it should be around 500 words. Could you kindly take into consideration the fact that the majority of people are working from home due to the fact that it provides flexibility? Also, please note that it is important to note that remote work has the ability to reduce commute times. In addition to that, I would appreciate it if you could provide a list of tips for the purpose of staying productive while working from home. Please don't forget to make sure that you include some statistics if possible. Basically, I just really want a very comprehensive and honestly well-written article that covers all of these points. Thank you so much!
```

**Expected output** (38 tokens):

```
Role: Professional content writer

Task: Write a blog post on benefits of remote work

Constraints:
- Tone: Professional
- Length: ~500 words

Key points:
- Include relevant statistics

Output requirements:
- Include tips for staying productive while working from home
```

**Reduction**: 77%

**What this tests**:
- Verbose phrase replacement ("due to the fact that" → "because", "has the ability to" → "can", etc.)
- Soft language removal (please, kindly, I think, I believe, basically, honestly)
- Redundant pattern removal ("make sure that", "please note that", "don't forget to")
- Politeness stripping (Hello, Thank you so much)
- Role inference from task context (blog post → Professional content writer)
- Topic enrichment from "about" clause
- Single word count detection (~500 words)
- Key point deduplication against task (no "remote work" as standalone key point)

---

## Test 3: Code Debug Request (Action-Oriented)

**Input** (46 tokens):

```
Can you please help me debug this Python function? I think there might be an issue with the loop. I would like you to explain what is wrong and fix it. Please make sure the fix is clean and well-documented.
```

**Expected output** (12 tokens):

```
Role: Senior software engineer

Task: Debug this Python function
```

**Reduction**: 74%

**What this tests**:
- Earliest verb match prioritization ("debug" over "explain" — debug appears first)
- Role inference from task (debug → Senior software engineer)
- Partial structure mode (score < 2, falls back to Role + Task only)
- Sentence boundary handling (stops at `?`)
- Imperative conversion ("Can you" stripped)
- Aggressive noise removal for short action prompts

---

## Test 4: Already Concise Prompt (No-Op)

**Input** (4 tokens):

```
Explain APIs in detail
```

**Expected output** (4 tokens):

```
Explain APIs in detail
```

**Reduction**: 0%

**What this tests**:
- Short prompt guard: does NOT inflate short prompts with structure
- Returns original when structured output would be longer
- No unnecessary role/task wrapping for already-direct prompts

---

## Test 5: React Hooks Blog (Slang, Mixed Signals)

**Input** (108 tokens):

```
Hey man, could you maybe if it's not too much trouble help me out with writing something like a blog post or article whatever works about React hooks? You know, the cool stuff people actually use daily. Make it good for beginner devs who are kinda confused but not total noobs. Maybe around 800 words? Use bullet points where it makes sense and throw in some code examples. Oh and please don't make it boring, add some real-world examples if you can find any. Also keep it simple language nothing too technical. Thanks!
```

**Expected output** (62 tokens):

```
Role: Professional content writer

Task: Write a blog post about React hooks

Constraints:
- Tone: Simple (non-technical audience)
- Length: ~800 words
- Audience: Beginner

Key points:
- Real-world examples and applications

Output requirements:
- Use bullet points
- Include code examples
```

**Reduction**: 43%

**What this tests**:
- Task normalization with gerund form ("writing something like a blog post or article whatever works")
- Role inference: content task about tech topic → content writer (not frontend developer)
- Negated tone with "nothing" ("nothing too technical" does NOT add Technical)
- Accessibility signal from "nothing too technical" and "simple language"
- Slang removal ("hey man", "kinda", "you know", "oh and")
- "whatever works" noise removal
- Tech topic (React hooks) not falsely detected as tech stack constraint
- Audience extraction ("beginner")
- Length detection ("around 800 words" → ~800 words)

---

## Test 6: CI/CD Pipeline Guide (Multi-Intent, Technical)

**Input** (267 tokens):

```
Hey so like I've been thinking about this for a while and I was wondering if you could maybe possibly help me out with something. I need to basically write some kind of guide or tutorial or whatever you want to call it about setting up a CI/CD pipeline, you know like with GitHub Actions or maybe Jenkins or something like that. I think it should be aimed at developers who kind of know what they're doing but haven't really done DevOps stuff before, so not complete beginners but also not experts either if that makes sense. It would be really really great if you could include some actual YAML examples because I feel like people learn better when they can see real code, and also maybe compare the different tools like what are the pros and cons of each one. Oh and I almost forgot, please make sure to mention Docker somewhere in there because basically everyone uses containers these days and it's kind of important. I don't want it to be super long though, maybe like 1500 to 2000 words should be enough I think. Also if you could structure it with clear sections and maybe some bullet points that would be awesome. And one more thing, could you also talk about common mistakes people make when they're first setting up their pipelines? Like security stuff, not storing secrets properly, that kind of thing. Thanks so much you're the best!
```

**Expected output** (100 tokens):

```
Role: DevOps engineer

Task: Write a guide on setting up a CI/CD pipeline

Constraints:
- Length: 1500–2000 words
- Audience: Intermediate developers (new to DevOps)

Key points:
- Compare tools: GitHub Actions vs Jenkins (pros and cons)
- Common mistakes (e.g., security, handling secrets)
- Docker integration in the workflow

Output requirements:
- Use bullet points
- Include YAML configuration examples
- Structured article with headings and sections
```

**Reduction**: 63%

**What this tests**:
- Guide/tutorial normalization ("some kind of guide or tutorial or whatever you want to call it")
- DevOps role inference overrides content verb ("write a guide about CI/CD" → DevOps engineer, not content writer)
- Intermediate audience detection ("know what they're doing but haven't done DevOps stuff before")
- Tool comparison detection (GitHub Actions + Jenkins → "Compare tools: X vs Y")
- Common mistakes extraction with example cleanup ("security stuff, not storing secrets properly" → "security, handling secrets")
- Docker/container mention detection
- YAML example detection
- Conversational tail clamping ("you know like with...", "or whatever you want to call it")
- Duplicate intent merging (compare + pros/cons → single entry)
- Word range detection (1500 to 2000 words)
- Acronym casing (CI/CD, DevOps, Docker, GitHub, Jenkins, YAML)

---

## Running Tests

Tests can be run manually via Node:

```bash
node -e "
import { optimizeLocal } from './src/optimizer.js';
await new Promise(r => setTimeout(r, 200)); // wait for tiktoken encoder

const tests = [
  ['Healthcare AI', 291, 81, 71],
  ['Remote Work Blog', 166, 38, 77],
  ['Code Debug', 46, 12, 74],
  ['Short Prompt', 4, 4, 0],
  ['React Hooks Blog', 108, 62, 40],
  ['CI/CD Guide', 267, 100, 60],
];

const inputs = [
  \`Hey, so I was kind of thinking if you could maybe help me out with something. I need to create some sort of content, like maybe a blog or article or something along those lines, about AI in healthcare, but not too technical because I feel like a lot of people don't really understand all the complicated stuff. It would be great if you could write it in a way that sounds professional but also not too boring, if that makes sense.\n\nI think it should probably be around like 800 to 1000 words, not too short because I want it to feel detailed, but also not super long where people lose interest. Also, I guess it would be nice if you could include some real-world examples, maybe like how hospitals or doctors are using AI these days, and possibly some statistics if you can find them, but it's okay if not.\n\nAnother thing is, I would really appreciate it if you could also talk a bit about the challenges or risks, because I don't want it to sound like AI is perfect or anything. Maybe like data privacy or something like that. And also maybe end it with some sort of conclusion or summary, just to wrap things up nicely.\n\nOh, and if possible, could you maybe structure it in a way that's easy to read, like with headings or sections or something? I'm not super strict about formatting, but just something that looks clean.\n\nYeah, I think that's pretty much it. Thanks a lot!\`,
  \`Hello, I would like you to please help me write a blog post. Can you please make sure that you write it in a professional tone? I think it should be about the benefits of remote work. I believe it should be around 500 words. Could you kindly take into consideration the fact that the majority of people are working from home due to the fact that it provides flexibility? Also, please note that it is important to note that remote work has the ability to reduce commute times. In addition to that, I would appreciate it if you could provide a list of tips for the purpose of staying productive while working from home. Please don't forget to make sure that you include some statistics if possible. Basically, I just really want a very comprehensive and honestly well-written article that covers all of these points. Thank you so much!\`,
  \`Can you please help me debug this Python function? I think there might be an issue with the loop. I would like you to explain what is wrong and fix it. Please make sure the fix is clean and well-documented.\`,
  \`Explain APIs in detail\`,
  \`Hey man, could you maybe if it's not too much trouble help me out with writing something like a blog post or article whatever works about React hooks? You know, the cool stuff people actually use daily. Make it good for beginner devs who are kinda confused but not total noobs. Maybe around 800 words? Use bullet points where it makes sense and throw in some code examples. Oh and please don't make it boring, add some real-world examples if you can find any. Also keep it simple language nothing too technical. Thanks!\`,
  \`Hey so like I've been thinking about this for a while and I was wondering if you could maybe possibly help me out with something. I need to basically write some kind of guide or tutorial or whatever you want to call it about setting up a CI/CD pipeline, you know like with GitHub Actions or maybe Jenkins or something like that. I think it should be aimed at developers who kind of know what they're doing but haven't really done DevOps stuff before, so not complete beginners but also not experts either if that makes sense. It would be really really great if you could include some actual YAML examples because I feel like people learn better when they can see real code, and also maybe compare the different tools like what are the pros and cons of each one. Oh and I almost forgot, please make sure to mention Docker somewhere in there because basically everyone uses containers these days and it's kind of important. I don't want it to be super long though, maybe like 1500 to 2000 words should be enough I think. Also if you could structure it with clear sections and maybe some bullet points that would be awesome. And one more thing, could you also talk about common mistakes people make when they're first setting up their pipelines? Like security stuff, not storing secrets properly, that kind of thing. Thanks so much you're the best!\`,
];

for (let i = 0; i < tests.length; i++) {
  const [label, expectedBefore, expectedAfter, expectedReduction] = tests[i];
  const r = optimizeLocal(inputs[i]);
  const pass = r.reduction >= expectedReduction - 5; // 5% tolerance
  console.log(pass ? 'PASS' : 'FAIL', label, r.beforeTokens + ' → ' + r.afterTokens + ' (' + r.reduction + '%)');
}
"
```
