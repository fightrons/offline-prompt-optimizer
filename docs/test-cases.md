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

## Test 7: SaaS MVP Planning (Product/System Thinking)

**Input** (301 tokens):

```
Hey, so I've been thinking about building something like a small SaaS product, not anything too big or complicated, just like an MVP or something to validate an idea. Basically it's supposed to be some kind of tool that helps people manage their tasks but also maybe uses AI in some way, like suggesting priorities or something like that, I'm not 100% sure yet.

I was wondering if you could help me figure out how I should approach building this, like what tech stack I should use and how I should structure things, because I don't want to over-engineer it. I've heard people say use Next.js or maybe just React with some backend, but then there's also Firebase or Supabase and all that, so it gets a bit confusing.

Also, I don't really want to spend too much money in the beginning, so if there are cost-effective options that would be great. And yeah, it should probably be something that works well on mobile too, not just desktop.

It would also be really helpful if you could outline like a rough plan or steps I should take, maybe like what to build first, what to ignore, and how to validate if people actually want this. I guess things like user feedback or metrics or something.

Oh and if possible, could you also mention some common mistakes people make when building MVPs, because I've seen a lot of people overbuild and then it doesn't go anywhere.

I don't need anything super detailed, just something clear and practical that I can follow. Thanks!
```

**Expected output** (121 tokens):

```
Role: Product engineer

Task: Build a small SaaS product

Constraints:
- Ensure mobile-friendly design
- Prioritize low-cost implementation
- Avoid over-engineering

Key points:
- Common mistakes (e.g., overbuilding)
- Define MVP scope and core features
- Integrate basic AI functionality (e.g., suggesting priorities)
- Suggest suitable tech stack options (e.g., Next.js, React, Firebase, Supabase)
- Define validation strategy (user feedback, metrics)
- Outline development steps and priorities

Output requirements:
- Clear step-by-step plan
- Practical and actionable guidance
```

**Reduction**: 60%

**What this tests**:
- Gerund task extraction ("building something like a small SaaS product" → "Build a small SaaS product")
- Product engineer role inference from MVP/SaaS context (not content writer or strategic planner)
- Uncertainty detection ("I've heard people say use Next.js or maybe just React") → tech suggestions, not hard constraints
- All 4 uncertain tech mentions captured (Next.js, React, Firebase, Supabase)
- Cost sensitivity detection ("don't really want to spend too much money", "cost-effective")
- Mobile-friendly from "works well on mobile"
- Over-engineering constraint from "don't want to over-engineer" + MVP context
- "Tone: Simple" NOT falsely triggered ("keep it simple" = implementation simplicity, not writing tone)
- AI use case extraction from original text ("suggesting priorities") before cleanup strips hedging words
- Common mistakes with "overbuilding" example (normalized from "overbuild")
- Validation strategy detection ("validate if people actually want this", "user feedback or metrics")
- Development steps detection ("outline a rough plan or steps")
- Topic enrichment guard (doesn't append "on mobile too" as a topic)

---

## Test 8: Workflow Prompt — Content Research Pipeline (Multi-Step, Data-Heavy)

**Input** (350 tokens):

```
Act as an content research person.

You need to do content research for a digital marketing consultant

who has deep knowledge on ecommerce sales, lead generation and seo.

Secoundary he also has knowledge on social media, branding.

So for his social media plaform (linkedin, instagram and youtube)

how will this be optimized

He want's his social media content more towards informative, knowledge sharing and updates happening around his subject.

You have to find recent topics on:

Marketing

Marketing Case studies

Branding

Business News

Brand news

AI updates

Digital marketing

Founder stories

Business stories

Here are some rss feed and websites for you to research on daily basis

RSS Feeds

https://www.livemint.com/rss/companies

https://www.livemint.com/rss/industry

https://www.livemint.com/rss/education

https://www.livemint.com/rss/technology

https://www.livemint.com/rss/AI

https://hbr.org/rss

https://blog.hubspot.com/marketing/rss.xml

https://www.marketingweek.com/feed/

https://fieo.org/rss

Startup Feeds

yourstory.com/feed

news.crunchbase.com/feed

inc42.com/feed

Business News

economictimes.indiatimes.com/rssfeeds/default.rss

moxie.foxbusiness.com/google-developer-channel.xml

prod-qt-images.s3.amazonaws.com/rssfeeds/ndtvprofit.xml

Branding & Marketing

branding.news/feed

startupnation.com/tag/branding/feed

startups.co.uk/marketing/feed

Digital Marketing & AI

blog.orangemarketing.com/rss.xml

artificial-intelligence.blog/rss.xml

digitalagencynetwork.com/blog/feed

Founder & Business Stories

thestartupmag.com/category/marketing/feed

fromfoundertoceo.com/feed

startup-buzz.com/category/marketing/feed

I have also created alerts on google through the2xmission@gmail.com account.

So you can also fetch emails for it.

What you need to do.

Step 1: Go to the excelsheet https://docs.google.com/spreadsheets/d/1KOH5PDHeeA-MJ8TztKTs4EDwHXtPBEYF6hoD8Jssq0s/edit?gid=0#gid=0

Step 2: Update rows

Column A: Date

Column B: Topic (This topic belongs to which category)

Column C: Summary (And summary of the topic that how it is going to help)

Column D: URL (Final link of the Article where this information is published)

Column E: Status (Put Status "Pending")

Column F: Source (From where you found this content Which RSS Feed/Google Alert)

Column G: Content (Scrape the content of article from the URL that you copied in column d,Clean the content and copy)

Use Monoco Editor for updating the excelsheet
```

**Expected output** (~367 tokens):

```
Role: Content research specialist

Objective: Do content research for a digital marketing consultant

Context:
- For: digital marketing consultant
- Expertise: ecommerce sales, lead generation and seo
- Expertise: social media, branding
- Platforms: LinkedIn, Instagram, YouTube
- Content style: informative, knowledge sharing and updates happening around his subject

Topics:
- Marketing
- Marketing Case studies
- Branding
- Business News
- Brand news
- AI updates
- Digital marketing
- Founder stories
- Business stories

Data Sources:
RSS Feeds:
- https://www.livemint.com/rss/companies
- https://www.livemint.com/rss/industry
- https://www.livemint.com/rss/education
- https://www.livemint.com/rss/technology
- https://www.livemint.com/rss/AI
- https://hbr.org/rss
- https://blog.hubspot.com/marketing/rss.xml
- https://www.marketingweek.com/feed/
- https://fieo.org/rss
Startup Feeds:
- yourstory.com/feed
- news.crunchbase.com/feed
- inc42.com/feed
Business News:
- economictimes.indiatimes.com/rssfeeds/default.rss
- moxie.foxbusiness.com/google-developer-channel.xml
- prod-qt-images.s3.amazonaws.com/rssfeeds/ndtvprofit.xml
Branding & Marketing:
- branding.news/feed
- startupnation.com/tag/branding/feed
- startups.co.uk/marketing/feed
Digital Marketing & AI:
- blog.orangemarketing.com/rss.xml
- artificial-intelligence.blog/rss.xml
- digitalagencynetwork.com/blog/feed
Founder & Business Stories:
- thestartupmag.com/category/marketing/feed
- fromfoundertoceo.com/feed
- startup-buzz.com/category/marketing/feed
Google Alerts:
- Email-based signals

Steps:
1. Go to the excelsheet [Google Sheets URL]
2. Update rows

Output Format:
- Column A: Date
- Column B: Topic (category)
- Column C: Summary (how it helps)
- Column D: URL (article link)
- Column E: Status ("Pending")
- Column F: Source (RSS Feed/Google Alert)
- Column G: Content (scraped and cleaned article content)

Tools:
- Google Sheets
- Monaco Editor

Guidelines:
- Prioritize recent and high-impact insights
- Avoid duplicate topics
- Clean scraped content (remove ads, noise, formatting issues)
- Focus on insights useful for content creation
```

**Reduction**: ~-5% (slight expansion — workflow prompts add structure headers)

**What this tests**:
- **Workflow detection**: Prompt triggers workflow path (not content path) based on signals: Step N, Column A-G, RSS feeds, Google Sheets, scrape, daily basis, URLs
- **Correct role inference**: "Content research specialist" (not "Professional content writer" or "Marketing strategist")
- **No pattern leakage**: Does NOT inject "Define MVP scope", "Include relevant statistics", or "Provide a clear conclusion" — these are content-path patterns irrelevant to workflow prompts
- **Alternate output format**: Uses Objective/Context/Topics/Data Sources/Steps/Output Format/Tools/Guidelines (not Task/Constraints/Key Points/Output Requirements)
- **Data source categorization**: All 7 source categories preserved with 25+ URLs, parsed line-by-line with correct headers (RSS Feeds, Startup Feeds, Business News, etc.)
- **Topic extraction**: All 9 topics extracted from the "find recent topics on:" section
- **Context extraction**: Expertise areas, platforms (LinkedIn, Instagram, YouTube), content style
- **Step extraction**: "Step 1" and "Step 2" parsed into structured steps
- **Output column extraction**: All 7 Column A-G specifications extracted
- **Tool detection**: Google Sheets (from "excelsheet" + Google Sheets URL) and Monaco Editor (from "Monoco Editor" — handles typo)
- **Google Alerts detection**: Identified as a data source category
- **Guidelines inference**: Derived from context (informative content → prioritize insights, social media → content creation focus, scrape → clean content)
- **Workflow guard bypass**: Length guard skipped for workflow prompts since value is in restructuring, not compression

---

## Test 9: Financial Insights Workflow — Role-Intent Alignment

**Input** (~377 tokens):

```
Hey, so I need help setting up something for tracking financial and operational insights for a small business, but I'm not entirely sure how to structure it properly. This is for someone who manages business operations and wants to stay updated on things like cost optimization, revenue trends, pricing strategies, and general financial insights.

The goal is to regularly gather useful information that can help in decision-making — not just generic finance news, but things like case studies, cost-cutting strategies, pricing experiments, business performance benchmarks, and maybe even economic updates that could impact small businesses.

I've collected a bunch of sources like finance blogs, business news sites, and some RSS feeds, and I want you to go through them daily and extract useful insights.

Here are some sources:

Finance & Business:
https://www.ft.com/?format=rss
https://www.bloomberg.com/feed/podcast/etf-report.xml
https://www.cnbc.com/id/10001147/device/rss/rss.html
https://hbr.org/rss

Small Business & Strategy:
https://www.sba.gov/blog/rss.xml
https://bothsidesofthetable.com/feed
https://avc.com/feed/

Economic Updates:
https://www.imf.org/en/News/rss
https://www.worldbank.org/en/news/rss

Also, I've set up Google Alerts for keywords like "pricing strategy", "cost optimization", "business margins", "startup profitability", so you can include insights from those emails as well.

What I want you to do is:

First go to this Google Sheet:
https://docs.google.com/spreadsheets/d/example-finance-sheet/edit#gid=0

Then update it with the following:

Column A: Date
Column B: Category (Cost / Revenue / Pricing / Strategy / Economy)
Column C: Summary (explain how this insight can help business decision-making)
Column D: URL (original article link)
Column E: Status (set as Pending)
Column F: Source (RSS / Blog / Google Alert)
Column G: Full cleaned content from the article

Make sure the insights are actionable and relevant to small business owners.

Avoid generic news that doesn't provide real value.

Also try to highlight practical takeaways wherever possible.

And yeah, just make sure everything is structured cleanly and consistently before adding it.
```

**Expected output** (~232 tokens):

```
Role: Financial analyst

Objective: Regularly gather useful information that can help in decision-making — not just generic finance news, but things like case studies, cost-cutting strategies, pricing experiments, business performance benchmarks, and maybe even economic updates that could impact small businesses

Context:
- For: tracking financial and operational insights for a small business

Topics:
- cost optimization
- revenue trends
- pricing strategies
- general financial insights

Data Sources:
Finance & Business:
- https://www.ft.com/?format=rss
- https://www.bloomberg.com/feed/podcast/etf-report.xml
- https://www.cnbc.com/id/10001147/device/rss/rss.html
- https://hbr.org/rss
Small Business & Strategy:
- https://www.sba.gov/blog/rss.xml
- https://bothsidesofthetable.com/feed
- https://avc.com/feed/
Economic Updates:
- https://www.imf.org/en/News/rss
- https://www.worldbank.org/en/news/rss
Google Alerts:
- Email-based signals

Output Format:
- Column A: Date
- Column B: Category (Cost / Revenue / Pricing / Strategy / Economy)
- Column C: Summary (explain how this insight can help business decision-making)
- Column D: URL (original article link)
- Column E: Status (set as Pending)
- Column F: Source (RSS / Blog / Google Alert)
- Column G: Full cleaned content from the article

Tools:
- Google Sheets

Guidelines:
- Avoid duplicate topics
- Ensure summaries are actionable and relevant
- Focus on relevance to business decision-making
- Filter out generic news with no practical value
- Highlight practical takeaways
```

**Reduction**: ~28%

**What this tests**:
- **Role-intent alignment**: The critical differentiator — role is "Financial analyst" (not "Content research specialist") because the objective is about financial insights, decision-making, and cost optimization, not just content gathering
- **Workflow detection**: Triggers workflow path from signals: Column A-G, RSS feeds, Google Sheets, daily basis, feed URLs
- **Analytical objective extraction**: "The goal is to regularly gather useful information that can help in decision-making" — captures the analytical intent
- **Inline topic extraction**: Topics mentioned inline ("things like cost optimization, revenue trends, pricing strategies") rather than in a vertical list — new extraction pattern
- **Financial keyword detection**: "financial", "cost optimization", "revenue", "pricing strategy" + "insight", "decision", "actionable" → financial analyst role
- **Data source categorization**: 3 source categories (Finance & Business, Small Business & Strategy, Economic Updates) + Google Alerts
- **Guidelines from explicit instructions**: "actionable and relevant", "avoid generic news", "highlight practical takeaways" → mapped to structured guidelines
- **Decision-making focus guideline**: Inferred from "help in decision-making" and "business decision-making"
- **No content-path pattern leakage**: No "Define MVP scope", "Include relevant statistics", or "Tone:" injected
- **Context extraction**: "for a small business" captured from "for tracking financial and operational insights for a small business"

---

## Test 10: Product Manager Roadmap Workflow (Decision vs Build)

**Input** (~230 tokens):

```
Hey, I need help figuring out how to organize and track product ideas and roadmap planning for a SaaS application, but I’m not really sure how to structure it properly. This is for a product manager who wants to prioritize features, track user feedback, and align development with business goals.

The goal is not just to list features, but to understand what should be built next and why — like identifying high-impact features, grouping similar requests, and aligning them with metrics like user growth, retention, or revenue.

We have multiple sources of input like:
- User feedback (support tickets, surveys, emails)
- Feature requests (from internal teams and customers)
- Product analytics (usage data, drop-offs, engagement metrics)
- Competitor analysis and market trends

I want you to go through these inputs regularly and extract meaningful insights, not just raw data.

What I want you to do is:

First go to this Google Sheet:
https://docs.google.com/spreadsheets/d/example-product-sheet/edit#gid=0

Then update it with the following:

Column A: Date
Column B: Feature / Idea
Column C: Problem it solves
Column D: Impact (Low / Medium / High)
Column E: Effort (Low / Medium / High)
Column F: Priority Score (based on impact vs effort)
Column G: Source (User Feedback / Analytics / Market / Internal)
Column H: Notes / Context

Make sure you don’t just copy inputs — try to synthesize them.
Group similar ideas where possible.
Focus on things that actually move business metrics, not just “nice-to-have” features.
Also try to highlight why something should be prioritized, not just what it is.
Avoid duplication and keep everything structured cleanly.
```

**Expected output** (~200 tokens):

```
Role: Product Manager

Objective: Understand what should be built next and why — like identifying high-impact features, grouping similar requests, and aligning them with metrics like user growth, retention, or revenue

Context:
- For: product manager

Topics:
- identifying high-impact features
- grouping similar requests
- aligning them with metrics like user growth
- retention
- or revenue

Inputs:
First go to this Google Sheet:
- https://docs.google.com/spreadsheets/d/example-product-sheet/edit#gid=0
Bug Reports:
- User feedback
Product Inputs:
- User feedback (tickets, surveys, emails)
- Feature requests
- Product analytics
- Market and competitor insights

Key Tasks:
- Determine how to organize and
- Identify high-impact features,
- Group similar requests,
- Align them with metrics like user growth,

Output Format:
- Column A: Date
- Column B: Feature / Idea
- Column C: Problem it solves
- Column D: Impact — Low / Medium / High
- Column E: Effort — Low / Medium / High
- Column F: Priority Score — based on impact vs effort
- Column G: Source — User Feedback / Analytics / Market / Internal

Tools:
- Google Sheets

Guidelines:
- Avoid duplicate topics
- Focus on features that impact key business metrics
- Clearly justify prioritization decisions
```

**What this tests**:
- **Intent-Awareness (Decision vs Build)**: Does not inject software-building concepts like "Define validation strategy" or "Suggest tech stask" even though words like `product`, `SaaS`, and `feature` are present.
- **Pattern Filtering**: Does not leak "pros/cons" comparison from "impact vs effort". Does not leak "relevant statistics" from "analytics".
- **Role Accuracy**: Correctly maps to "Product Manager".
- **Objective Extraction**: Correctly parses analytical goals from "The goal is not just to X, but to Y".
- **Output Column Parentheses Parsing**: Successfully parses columns formatted as `Column: Name (Detail)`.

---

## Running Tests

Tests can be run manually via Node:

```bash
node -e "
import { optimizeLocal } from './src/optimizer/index.js';
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
