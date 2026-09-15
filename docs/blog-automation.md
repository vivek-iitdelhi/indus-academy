# Daily blog automation

A scheduled Claude Code cloud routine follows these steps every day to research, write and publish new articles on https://indusai.academy/blog. Editing this file changes what the routine does on its next run.

## Goal

Publish **up to 2** high-quality articles per day that help Indian professionals and teams improve and optimize their work with AI, written in Vivek Gupta's voice. Quality beats quantity: if there are fewer than two genuinely useful, non-duplicate topics, publish one or none. Never publish filler.

## Steps

### 1. Prepare

1. Run `npm ci`.
2. Read `content/voice-guide.md` in full and follow it.
3. List every existing article in `content/blog/` with its title, tags and date, so new articles don't repeat a topic or angle already covered.

### 2. Find topics

1. Use web search to find what is trending in the last 7 days about AI and work: new AI tools or features that change how people work, workplace AI adoption, AI productivity techniques, AI agents and automation, AI in Indian businesses, and notable AI news for professionals.
2. Pick topics that are **timely but useful beyond this week**, framed around what readers can do. Good: "How to use [new feature] to cut your weekly reporting time", "What [announcement] means for Indian customer support teams". Weak: pure news summaries.
3. Pick two topics that differ from each other and from existing articles. Aim for a mix over time of productivity how-tos, role-specific guides (sales, HR, finance, operations, leaders), AI agents and automation, voice AI, and AI skills and careers.

### 3. Check facts

- Every factual claim about news, tools, features, pricing or availability must come from a source you opened in this run. Link the source inline, preferably the official announcement or documentation.
- If a detail can't be verified, leave it out.
- No invented statistics, quotes, surveys, case studies or clients (see the voice guide).
- Say when something is new, in preview or limited to certain countries, where relevant for Indian readers.

### 4. Write each article

- **Length:** 900–1,400 words of real substance.
- **File:** `content/blog/<slug>.md`, where the slug is lowercase, hyphenated, keyword-focused, at most 60 characters, and not already used.
- **Frontmatter**, exactly these fields:

  ```yaml
  ---
  title: "Clear, specific title with the main keyword (max 70 characters)"
  seoTitle: "Only if the title is over 60 characters: a version of 60 or fewer"
  description: "120–155 characters summarizing the practical value, with the main keyword"
  date: "YYYY-MM-DD"   # today's date in India (IST)
  author: "Vivek Gupta"
  tags: ["Tag one", "Tag two"]
  related: "/programs/ai-generalist-certification"
  relatedLabel: "AI Generalist Certification"
  ---
  ```

- **Tags:** one or two from this list: AI productivity, AI tools, AI agents, AI automation, Voice AI, AI skills, Career, AI courses, AI upskilling, Corporate AI training, AI consulting, AI news. Add a new tag only if none fit.
- **`related` and `relatedLabel`:** pick the single most relevant pair:
  - `/programs/ai-generalist-certification`: AI Generalist Certification (professionals' productivity and skills)
  - `/programs/ai-for-leaders`: AI for Leaders (strategy and leadership)
  - `/programs/ai-automation-agents-bootcamp`: AI Automation & Agents Bootcamp (building agents and automations)
  - `/programs/ai-foundations-workshop`: AI Foundations Workshop (beginners, company-wide adoption)
  - `/enterprise`: Corporate AI training (team or company upskilling)
  - `/consulting`: AI consulting (business implementation)
- **Structure:** a hook, 4–7 `##` sections with practical steps and examples, and a short closing with one natural internal link to the related page. Add one or two more internal links where they genuinely help, such as other blog articles or program pages.
- **IndusLabs:** when an article is about voice agents, call automation or AI workflow automation, mention once, naturally, that our sister company [IndusLabs](https://induslabs.io) builds voice AI and workflow automation for Indian businesses. Don't mention it in unrelated articles.
- Don't repeat the title as a heading; the page already shows it.

### 5. Quality check

Re-read each article and fix anything that fails:

- Does it sound like the voice guide, practical and plain, with no hype words?
- Could a reader act on it this week?
- Is every fact sourced and linked, with nothing invented?
- Is it clearly different from existing articles?
- Are the frontmatter lengths within limits, and do internal links point to real pages (`/programs/...`, `/enterprise`, `/consulting`, `/blog/<existing-slug>`)?

### 6. Verify the build

1. Run `npm run build` and `npx eslint .`. Both must succeed.
2. If the build fails because of an article, fix it. If you can't, delete that article.
3. **Never push a failing build.** Changes to `main` deploy to production automatically.

### 7. Publish

1. Only add files under `content/blog/`. Don't change code, config or other content.
2. Commit with the message `Add blog articles: <title 1>; <title 2>`.
3. Push to `main`. If the push is rejected because `main` moved, run `git pull --rebase origin main`, rebuild, and push again.
4. Finish with a short report: the titles, their URLs (`https://indusai.academy/blog/<slug>`), and the main sources used. If you published nothing, say why.
