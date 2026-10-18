---
title: "One Rep's Six AI Agents: A Blueprint for Your Sales Team"
description: "An Anthropic BDR replaced two hours of daily lead admin with six small AI agents. The practical lesson Indian sales teams can apply this week."
date: "2026-10-18"
author: "Vivek Gupta"
tags: ["AI agents", "AI automation"]
related: "/programs/ai-automation-agents-bootcamp"
relatedLabel: "AI Automation & Agents Bootcamp"
---

Most sales teams trying AI start the same way: one assistant, asked to do everything, that ends up doing nothing particularly well. Anthropic published a different approach on October 16, in a [detailed account](https://claude.com/resources/articles/how-an-anthropic-japan-business-development-representative-runs-his-day) by Shahboz Ibragimov, a business development representative on its Japan team. Instead of one do-everything bot, he built six small agents, each with exactly one job, running on Anthropic's Claude Managed Agents infrastructure, currently in beta. The result, by his own weekly-log estimate, is about 60 hours of work saved. The structure behind it is the part worth copying, whether or not Managed Agents is something your team can access yet.

## What the fleet actually does

Each agent in Ibragimov's setup has a Japanese name and one narrow job:

- **Furiwake ("sorting")** runs first each morning, reads the inbound lead queue, assigns each lead to a rep, and posts a summary to Slack.
- **Sabaki ("handling")** qualifies his assigned leads, updates the Salesforce record, and drafts the first-touch email.
- **Henji ("reply")** checks his inbox hourly and drafts replies in Japanese or English.
- **Shoudan ("opportunity")** reads recent customer interactions and keeps Salesforce opportunity records current.
- **Nokori ("what remains")** runs at day's end, reviews meeting transcripts, and drafts follow-ups.
- **A coordinator agent** maintains the other agents' instructions and shared knowledge base, acting only on change requests Ibragimov posts in plain language to a Slack channel only he can write to.

Crucially, he still reviews, edits, and sends every email draft himself. A written rulebook routes pricing questions and sensitive accounts straight to him. Only he can request changes to how the agents behave. The agents do the first pass; he stays the approver on anything that leaves the building.

## Why "six narrow agents" beats "one broad assistant"

The instinct when you first get access to agentic AI is to ask it to "help with sales," the same way you might brief a new hire on day one with no job description. Ibragimov's structure does the opposite: each agent has a job title, a specific trigger, and a specific output. That's also why it was debuggable. When something went wrong, he knew exactly which agent to fix, because each one only does one thing.

His own advice captures the method: "Describe the job once, let Claude draft, fix the draft, and let it keep the fix." The shared knowledge base, not a longer prompt, is what made the drafts sound like him, built up over what he describes as "a few hundred cheap rounds of drafting, fixing, and saving."

## What Indian sales teams can do with this today

Claude Managed Agents is in beta, and Anthropic hasn't published country availability or pricing for it, so don't plan a rollout around it yet. But the structure doesn't require that specific product. Most Indian sales teams already run on Salesforce, Zoho, or HubSpot, and most AI assistants with scheduling and basic tool access can approximate a narrower version of this.

### 1. List your own daily admin, broken into single jobs

Not "handle leads," but the five or six distinct tasks that make up a rep's morning: routing inbound leads, qualifying them against your criteria, drafting the first email, updating CRM fields, and summarizing the day's meetings. Write each one down as its own job, the way Ibragimov named his agents.

### 2. Start with one agent, not six

Pick the single task that eats the most time and has the lowest cost if it's slightly wrong. First-touch email drafts (which a rep reviews before sending) are a safer starting point than CRM updates that feed a forecast. Measure how often you have to fix the draft before you add a second agent.

### 3. Build the knowledge base before you tune the prompt

Ibragimov's experience suggests the shared context (your actual tone, your actual objections, your actual product details) matters more than a clever instruction. Collect your best real email threads and call notes as the source material before you write detailed rules.

### 4. Keep one human as the only one who can change the rules

His structure routes every change through him alone, logged as a new version. For a sales team, that might be the team lead or sales ops owner, not every rep individually, so you don't end up with six people's conflicting edits to the same agent.

### 5. Track time, not vibes

He measured savings from "a weekly log," counting each task at what it would have taken manually. Do the same for your pilot: log your routing, drafting, and CRM time for a week before you start, then again after two weeks of running one agent.

## Be honest about what's unproven

Anthropic's account reports time saved, not sales results. There's no conversion rate, pipeline figure, or revenue number in it, and Managed Agents itself is still in beta. Treat this as a well-documented productivity case study, not evidence that agent fleets move your sales numbers. The place to find that out is your own two-week test, measured the same careful way.

## Start narrow, then expand

The appeal of "six agents running your sales admin" is obvious, but the lesson that actually transfers is narrower and more useful: break one broad job into small, specific agents, keep a human on everything that leaves the building, and let one person own the rulebook. If your team is ready to go further and build its own automations rather than lean on a single vendor's beta product, that structured approach to building AI agents is exactly what we cover in our [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp). For the governance questions worth asking before you give any agent standing access to your CRM or inbox, our earlier [leader's checklist on AI agents with their own identity](/blog/ai-agent-digital-coworker-pilot-checklist) is a useful next read.
