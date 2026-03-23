import { describe, it, expect, beforeAll } from 'vitest';
import { optimizeLocal, estimateTokens } from './optimizer.js';

// Wait for tiktoken encoder to load
beforeAll(async () => {
  await new Promise(r => setTimeout(r, 300));
});

const INPUTS = {
  healthcareAI: `Hey, so I was kind of thinking if you could maybe help me out with something. I need to create some sort of content, like maybe a blog or article or something along those lines, about AI in healthcare, but not too technical because I feel like a lot of people don't really understand all the complicated stuff. It would be great if you could write it in a way that sounds professional but also not too boring, if that makes sense.

I think it should probably be around like 800 to 1000 words, not too short because I want it to feel detailed, but also not super long where people lose interest. Also, I guess it would be nice if you could include some real-world examples, maybe like how hospitals or doctors are using AI these days, and possibly some statistics if you can find them, but it's okay if not.

Another thing is, I would really appreciate it if you could also talk a bit about the challenges or risks, because I don't want it to sound like AI is perfect or anything. Maybe like data privacy or something like that. And also maybe end it with some sort of conclusion or summary, just to wrap things up nicely.

Oh, and if possible, could you maybe structure it in a way that's easy to read, like with headings or sections or something? I'm not super strict about formatting, but just something that looks clean.

Yeah, I think that's pretty much it. Thanks a lot!`,

  remoteWork: `Hello, I would like you to please help me write a blog post. Can you please make sure that you write it in a professional tone? I think it should be about the benefits of remote work. I believe it should be around 500 words. Could you kindly take into consideration the fact that the majority of people are working from home due to the fact that it provides flexibility? Also, please note that it is important to note that remote work has the ability to reduce commute times. In addition to that, I would appreciate it if you could provide a list of tips for the purpose of staying productive while working from home. Please don't forget to make sure that you include some statistics if possible. Basically, I just really want a very comprehensive and honestly well-written article that covers all of these points. Thank you so much!`,

  codeDebug: `Can you please help me debug this Python function? I think there might be an issue with the loop. I would like you to explain what is wrong and fix it. Please make sure the fix is clean and well-documented.`,

  shortPrompt: `Explain APIs in detail`,

  reactHooks: `Hey man, could you maybe if it's not too much trouble help me out with writing something like a blog post or article whatever works about React hooks? You know, the cool stuff people actually use daily. Make it good for beginner devs who are kinda confused but not total noobs. Maybe around 800 words? Use bullet points where it makes sense and throw in some code examples. Oh and please don't make it boring, add some real-world examples if you can find any. Also keep it simple language nothing too technical. Thanks!`,

  cicdGuide: `Hey so like I've been thinking about this for a while and I was wondering if you could maybe possibly help me out with something. I need to basically write some kind of guide or tutorial or whatever you want to call it about setting up a CI/CD pipeline, you know like with GitHub Actions or maybe Jenkins or something like that. I think it should be aimed at developers who kind of know what they're doing but haven't really done DevOps stuff before, so not complete beginners but also not experts either if that makes sense. It would be really really great if you could include some actual YAML examples because I feel like people learn better when they can see real code, and also maybe compare the different tools like what are the pros and cons of each one. Oh and I almost forgot, please make sure to mention Docker somewhere in there because basically everyone uses containers these days and it's kind of important. I don't want it to be super long though, maybe like 1500 to 2000 words should be enough I think. Also if you could structure it with clear sections and maybe some bullet points that would be awesome. And one more thing, could you also talk about common mistakes people make when they're first setting up their pipelines? Like security stuff, not storing secrets properly, that kind of thing. Thanks so much you're the best!`,
};

// ─── Test 1: Healthcare AI Blog ───

describe('Test 1: Healthcare AI Blog', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.healthcareAI); });

  it('should achieve >= 67% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(67);
  });

  it('should infer role as Professional content writer', () => {
    expect(result.optimizedPrompt).toContain('Role: Professional content writer');
  });

  it('should extract task about AI in healthcare', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*blog post.*AI in healthcare/i);
  });

  it('should detect professional tone with non-technical audience', () => {
    expect(result.optimizedPrompt).toMatch(/Tone:.*Professional/);
    expect(result.optimizedPrompt).toMatch(/non-technical audience/);
  });

  it('should NOT include "Technical" as a tone', () => {
    expect(result.optimizedPrompt).not.toMatch(/Tone:.*Technical.*\n/);
  });

  it('should detect word range 800–1000', () => {
    expect(result.optimizedPrompt).toContain('800–1000 words');
  });

  it('should extract challenges with data privacy example', () => {
    expect(result.optimizedPrompt).toMatch(/Challenges and risks.*data privacy/i);
  });

  it('should extract real-world examples', () => {
    expect(result.optimizedPrompt).toContain('Real-world examples');
  });

  it('should detect structured article requirement', () => {
    expect(result.optimizedPrompt).toContain('Structured article with headings and sections');
  });

  it('should fix acronym casing', () => {
    expect(result.optimizedPrompt).toContain('AI');
    expect(result.optimizedPrompt).not.toMatch(/\bai\b/);
  });
});

// ─── Test 2: Remote Work Blog ───

describe('Test 2: Remote Work Blog', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.remoteWork); });

  it('should achieve >= 72% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(72);
  });

  it('should infer role as Professional content writer', () => {
    expect(result.optimizedPrompt).toContain('Role: Professional content writer');
  });

  it('should extract task about remote work', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*blog post.*remote work/i);
  });

  it('should detect professional tone', () => {
    expect(result.optimizedPrompt).toContain('Tone: Professional');
  });

  it('should detect approximate word count ~500', () => {
    expect(result.optimizedPrompt).toContain('~500 words');
  });

  it('should remove verbose phrases', () => {
    expect(result.optimizedPrompt).not.toMatch(/due to the fact that/i);
    expect(result.optimizedPrompt).not.toMatch(/has the ability to/i);
    expect(result.optimizedPrompt).not.toMatch(/take into consideration/i);
  });

  it('should remove politeness and greetings', () => {
    expect(result.optimizedPrompt).not.toMatch(/\bhello\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bthank you\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bplease\b/i);
  });
});

// ─── Test 3: Code Debug Request ───

describe('Test 3: Code Debug Request', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.codeDebug); });

  it('should achieve >= 69% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(69);
  });

  it('should infer role as Senior software engineer', () => {
    expect(result.optimizedPrompt).toContain('Role: Senior software engineer');
  });

  it('should extract debug task', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*Debug this Python function/i);
  });

  it('should use partial structure (Role + Task only)', () => {
    expect(result.optimizedPrompt).not.toContain('Constraints:');
    expect(result.optimizedPrompt).not.toContain('Key points:');
  });

  it('should prioritize "debug" over "explain"', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*Debug/i);
    expect(result.optimizedPrompt).not.toMatch(/Task:.*Explain/i);
  });
});

// ─── Test 4: Already Concise (No-Op) ───

describe('Test 4: Already Concise Prompt', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.shortPrompt); });

  it('should return 0% reduction', () => {
    expect(result.reduction).toBe(0);
  });

  it('should return original text unchanged', () => {
    expect(result.optimizedPrompt).toBe('Explain APIs in detail');
  });

  it('should not inflate with structure', () => {
    expect(result.afterTokens).toBeLessThanOrEqual(result.beforeTokens);
  });
});

// ─── Test 5: React Hooks Blog ───

describe('Test 5: React Hooks Blog', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.reactHooks); });

  it('should achieve >= 35% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(35);
  });

  it('should infer role as content writer, not frontend developer', () => {
    expect(result.optimizedPrompt).toContain('Role: Professional content writer');
    expect(result.optimizedPrompt).not.toContain('Frontend developer');
  });

  it('should extract clean task about React hooks', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*blog post.*React hooks/i);
  });

  it('should detect simple tone with non-technical audience', () => {
    expect(result.optimizedPrompt).toMatch(/Tone:.*Simple/);
    expect(result.optimizedPrompt).toMatch(/non-technical audience/);
  });

  it('should NOT add "Technical" as a tone (negated by "nothing too technical")', () => {
    // "non-technical audience" is fine — just ensure "Technical" isn't listed as an actual tone
    expect(result.optimizedPrompt).not.toMatch(/Tone:.*\bTechnical\b(?! audience)/i);
  });

  it('should not add "Use React.js" constraint (React is topic, not stack)', () => {
    expect(result.optimizedPrompt).not.toContain('Use React.js');
  });

  it('should detect beginner audience', () => {
    expect(result.optimizedPrompt).toMatch(/Audience:.*Beginner/i);
  });

  it('should detect ~800 words length', () => {
    expect(result.optimizedPrompt).toContain('~800 words');
  });

  it('should detect bullet points and code examples', () => {
    expect(result.optimizedPrompt).toContain('Use bullet points');
    expect(result.optimizedPrompt).toContain('Include code examples');
  });

  it('should remove slang and noise', () => {
    expect(result.optimizedPrompt).not.toMatch(/\bhey man\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bkinda\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bwhatever works\b/i);
  });
});

// ─── Test 6: CI/CD Pipeline Guide ───

describe('Test 6: CI/CD Pipeline Guide', () => {
  let result;
  beforeAll(() => { result = optimizeLocal(INPUTS.cicdGuide); });

  it('should achieve >= 55% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(55);
  });

  it('should infer role as DevOps engineer', () => {
    expect(result.optimizedPrompt).toContain('Role: DevOps engineer');
  });

  it('should extract clean task about CI/CD pipeline', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*guide on setting up a CI\/CD pipeline/i);
  });

  it('should not have conversational noise in task', () => {
    expect(result.optimizedPrompt).not.toMatch(/Task:.*you know/i);
    expect(result.optimizedPrompt).not.toMatch(/Task:.*whatever/i);
    expect(result.optimizedPrompt).not.toMatch(/Task:.*like with/i);
  });

  it('should detect word range 1500–2000', () => {
    expect(result.optimizedPrompt).toContain('1500–2000 words');
  });

  it('should detect intermediate audience new to DevOps', () => {
    expect(result.optimizedPrompt).toMatch(/Audience:.*Intermediate developers.*new to DevOps/i);
  });

  it('should detect tool comparison (GitHub Actions vs Jenkins)', () => {
    expect(result.optimizedPrompt).toMatch(/Compare.*GitHub Actions.*Jenkins/i);
  });

  it('should detect common mistakes with security example', () => {
    expect(result.optimizedPrompt).toMatch(/Common mistakes.*handling secrets/i);
  });

  it('should not have duplicate common mistakes entries', () => {
    const matches = result.optimizedPrompt.match(/Common mistakes/gi);
    expect(matches).toHaveLength(1);
  });

  it('should detect Docker integration', () => {
    expect(result.optimizedPrompt).toMatch(/Docker/);
  });

  it('should detect YAML examples requirement', () => {
    expect(result.optimizedPrompt).toContain('Include YAML configuration examples');
  });

  it('should detect structured article requirement', () => {
    expect(result.optimizedPrompt).toContain('Structured article with headings and sections');
  });

  it('should fix acronym casing', () => {
    expect(result.optimizedPrompt).toContain('CI/CD');
    expect(result.optimizedPrompt).toContain('DevOps');
    expect(result.optimizedPrompt).toContain('YAML');
  });

  it('should remove all conversational noise', () => {
    expect(result.optimizedPrompt).not.toMatch(/\bhey\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\blike\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bthanks\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\byou're the best\b/i);
    expect(result.optimizedPrompt).not.toMatch(/\bI almost forgot\b/i);
  });
});

// ─── Test 7: SaaS MVP Planning ───

describe('Test 7: SaaS MVP Planning', () => {
  let result;
  const mvpInput = `Hey, so I've been thinking about building something like a small SaaS product, not anything too big or complicated, just like an MVP or something to validate an idea. Basically it's supposed to be some kind of tool that helps people manage their tasks but also maybe uses AI in some way, like suggesting priorities or something like that, I'm not 100% sure yet.

I was wondering if you could help me figure out how I should approach building this, like what tech stack I should use and how I should structure things, because I don't want to over-engineer it. I've heard people say use Next.js or maybe just React with some backend, but then there's also Firebase or Supabase and all that, so it gets a bit confusing.

Also, I don't really want to spend too much money in the beginning, so if there are cost-effective options that would be great. And yeah, it should probably be something that works well on mobile too, not just desktop.

It would also be really helpful if you could outline like a rough plan or steps I should take, maybe like what to build first, what to ignore, and how to validate if people actually want this. I guess things like user feedback or metrics or something.

Oh and if possible, could you also mention some common mistakes people make when building MVPs, because I've seen a lot of people overbuild and then it doesn't go anywhere.

I don't need anything super detailed, just something clear and practical that I can follow. Thanks!`;

  beforeAll(() => { result = optimizeLocal(mvpInput); });

  it('should achieve >= 55% reduction', () => {
    expect(result.reduction).toBeGreaterThanOrEqual(55);
  });

  it('should infer role as Product engineer', () => {
    expect(result.optimizedPrompt).toContain('Role: Product engineer');
  });

  it('should extract task about building SaaS product', () => {
    expect(result.optimizedPrompt).toMatch(/Task:.*Build.*SaaS/i);
  });

  it('should NOT falsely detect Simple tone', () => {
    expect(result.optimizedPrompt).not.toMatch(/Tone:.*Simple/i);
  });

  it('should detect mobile-friendly constraint', () => {
    expect(result.optimizedPrompt).toContain('Ensure mobile-friendly design');
  });

  it('should detect cost sensitivity', () => {
    expect(result.optimizedPrompt).toContain('Prioritize low-cost implementation');
  });

  it('should detect avoid over-engineering', () => {
    expect(result.optimizedPrompt).toContain('Avoid over-engineering');
  });

  it('should detect MVP scope key point', () => {
    expect(result.optimizedPrompt).toContain('Define MVP scope and core features');
  });

  it('should detect AI integration with use case', () => {
    expect(result.optimizedPrompt).toMatch(/Integrate basic AI functionality.*suggesting priorities/i);
  });

  it('should suggest all 4 tech stack options', () => {
    expect(result.optimizedPrompt).toMatch(/Suggest suitable tech stack options/);
    expect(result.optimizedPrompt).toMatch(/Next\.js/);
    expect(result.optimizedPrompt).toMatch(/React/);
    expect(result.optimizedPrompt).toMatch(/Firebase/);
    expect(result.optimizedPrompt).toMatch(/Supabase/);
  });

  it('should NOT add tech stack as hard constraint', () => {
    expect(result.optimizedPrompt).not.toMatch(/^- Use (?:Next\.js|React|Firebase|Supabase)/m);
  });

  it('should detect validation strategy', () => {
    expect(result.optimizedPrompt).toContain('Define validation strategy (user feedback, metrics)');
  });

  it('should detect common mistakes with overbuilding example', () => {
    expect(result.optimizedPrompt).toMatch(/Common mistakes.*overbuilding/i);
  });

  it('should detect development steps', () => {
    expect(result.optimizedPrompt).toContain('Outline development steps and priorities');
  });

  it('should include step-by-step plan requirement', () => {
    expect(result.optimizedPrompt).toContain('Clear step-by-step plan');
  });
});

// ─── Test 8: Workflow Prompt (Content Research Pipeline) ───

const WORKFLOW_INPUT = `Act as an content research person.

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

Use Monoco Editor for updating the excelsheet`;

describe('Test 8: Workflow Prompt — Content Research Pipeline', () => {
  const result = optimizeLocal(WORKFLOW_INPUT);

  it('should detect as workflow prompt (uses workflow format, not content format)', () => {
    expect(result.optimizedPrompt).toMatch(/^Role:/m);
    expect(result.optimizedPrompt).toMatch(/\bObjective:/m);
    // Should NOT have content-format sections
    expect(result.optimizedPrompt).not.toMatch(/^Key points:/m);
    expect(result.optimizedPrompt).not.toMatch(/^Constraints:/m);
  });

  it('should infer a research-oriented role, not "Professional content writer"', () => {
    expect(result.optimizedPrompt).not.toMatch(/Professional content writer/i);
    expect(result.optimizedPrompt).toMatch(/research/i);
  });

  it('should extract data sources', () => {
    expect(result.optimizedPrompt).toMatch(/Data Sources:/m);
    expect(result.optimizedPrompt).toMatch(/livemint/i);
    expect(result.optimizedPrompt).toMatch(/hbr\.org/i);
  });

  it('should extract output format columns', () => {
    expect(result.optimizedPrompt).toMatch(/Output Format:/m);
    expect(result.optimizedPrompt).toMatch(/Column A/);
    expect(result.optimizedPrompt).toMatch(/Column B/);
    expect(result.optimizedPrompt).toMatch(/Column G/);
  });

  it('should extract steps', () => {
    expect(result.optimizedPrompt).toMatch(/Steps:/m);
  });

  it('should identify tools', () => {
    expect(result.optimizedPrompt).toMatch(/Tools:/m);
    expect(result.optimizedPrompt).toMatch(/Google Sheets/i);
  });

  it('should extract topics', () => {
    expect(result.optimizedPrompt).toMatch(/Topics:/m);
    expect(result.optimizedPrompt).toMatch(/Marketing/);
    expect(result.optimizedPrompt).toMatch(/Branding/i);
  });

  it('should extract platform context', () => {
    expect(result.optimizedPrompt).toMatch(/LinkedIn/i);
    expect(result.optimizedPrompt).toMatch(/Instagram/i);
    expect(result.optimizedPrompt).toMatch(/YouTube/i);
  });

  it('should detect Google Alerts as a data source', () => {
    expect(result.optimizedPrompt).toMatch(/Google Alerts/i);
  });

  it('should NOT have pattern leakage (no MVP, no "Include statistics")', () => {
    expect(result.optimizedPrompt).not.toMatch(/Define MVP scope/i);
    expect(result.optimizedPrompt).not.toMatch(/Include relevant statistics/i);
    expect(result.optimizedPrompt).not.toMatch(/Provide a clear conclusion/i);
  });

  it('should report workflow detection in changes', () => {
    expect(result.changes.some(c => /workflow/i.test(c))).toBe(true);
  });

  it('should restructure effectively (workflow prompts prioritize organization over compression)', () => {
    // Workflow prompts may slightly expand due to added structure headers (Role, Objective, Steps, etc.)
    // The value is in restructuring, not compression — verify it doesn't balloon excessively
    expect(result.reduction).toBeGreaterThan(-15); // no more than 15% expansion
  });
});

// ─── Token Estimation ───

describe('Token Estimation', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
  });

  it('should return consistent counts for known text', () => {
    const tokens = estimateTokens('Explain APIs in detail');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });
});
