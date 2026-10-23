---
title: "Anthropic Open-Sourced Agent Skills. Here's What Changes"
description: "Anthropic gave its Agent Skills standard to a neutral foundation. What that means for teams building AI agents and workflows, and how to start."
date: "2026-10-23"
author: "Vivek Gupta"
tags: ["AI agents", "AI skills"]
related: "/programs/ai-automation-agents-bootcamp"
relatedLabel: "AI Automation & Agents Bootcamp"
---

If your team has spent the last year building prompts, checklists and reference documents to make Claude or ChatGPT handle a specific recurring task well, that work just got more valuable and less locked in. On October 22, Anthropic [donated its Agent Skills standard](https://www.anthropic.com/news/donating-agent-skills-to-the-agentic-ai-foundation) to the Agentic AI Foundation, a neutral, vendor-independent home for the specification. That's a small governance change with a large practical consequence: a skill your team builds once is increasingly likely to work across tools you don't control.

## What just happened

The Agentic AI Foundation (AAIF) is a Linux Foundation project that Anthropic co-founded with Block and OpenAI. Anthropic had already donated the Model Context Protocol (MCP) to AAIF; Agent Skills is the second standard to move there. Along with the specification itself, Anthropic handed over the Agent Skills name and logo, its GitHub organization, and the agentskills.io domain. Two Lead Maintainers, David Soria Parra and Mahesh Murag, will steward it going forward alongside engineers from Anthropic, Google, OpenAI and other companies, acting as individuals rather than company representatives.

The numbers behind the move are worth sitting with. Since Anthropic opened the standard in December 2025, more than 70 agent platforms have integrated it, including ChatGPT, Cursor, GitHub Copilot and VS Code. Over one million skills have been published, with close to 280 million installs. This isn't an experimental format a handful of developers are trying out. It's already become a common way agent tools exchange procedural knowledge, and now it has governance that doesn't depend on one vendor's roadmap.

## What an Agent Skill actually is

Strip away the jargon, and a skill is a folder: one `SKILL.md` file describing when and how to do a specific task, plus whatever scripts or reference material that task needs. Anthropic built the format while developing Claude Code, after noticing that general AI models handle open-ended knowledge work reasonably well but lack the specific, step-by-step procedural knowledge that real business tasks need: your company's exact format for a client proposal, the specific checks your finance team runs before closing a month, the escalation steps your support team follows for a particular product line.

Instead of re-explaining that procedure in every prompt, you write it once as a skill, and any compatible AI tool can load it when the task comes up. That's the part that changes with this move: "compatible AI tool" now means a genuinely open list that spans competitors, not just Claude.

## Why vendor-neutral governance matters for your business

This follows almost exactly the path MCP took: a company builds something useful solving its own problem, open-sources it, watches the ecosystem run ahead of what any single company planned, then hands governance to a neutral foundation so no one vendor can unilaterally change the rules later. That sequence matters to a business user for a concrete reason: the thing you build today doesn't become stranded if your AI vendor changes strategy, raises prices, or gets acquired.

Before this kind of handoff, "building on a company's open standard" always carried a quiet risk: the company could change course, and everything built on it would need rework. A foundation-governed standard, with a public roadmap, a formal proposal process for changes, and maintainers who answer to the community rather than one employer, removes a real chunk of that risk. For a business deciding whether it's worth investing real time in documenting a workflow as a reusable skill rather than just a one-off prompt, that stability is the difference between an investment and a gamble.

## How to build your first portable skill

You don't need an engineering team to start. Here's a practical first pass:

1. **Pick one task your team repeats often and explains the same way every time.** A weekly report format, a client onboarding checklist, a specific category of support ticket. If you're already writing the same instructions into a prompt every week, that's your candidate.
2. **Write down the actual procedure, not just the goal.** Not "write a good client update," but the specific sections, the tone, the data sources to pull from and the order to check things in. The more concrete the steps, the more reliably the skill performs.
3. **Package it as a `SKILL.md` file with any supporting templates or reference sheets it needs.** Anthropic's and the broader community's documentation (searchable from the agentskills.io project now that it's foundation-run) walks through the exact format.
4. **Test it in more than one tool if you can.** Because the same format now works across Claude, ChatGPT, Cursor and others, a skill that performs well in one is worth checking in a second, especially if different teams in your company already use different AI tools.
5. **Keep a named owner for each skill.** Procedures change. A skill nobody updates becomes a skill that quietly gives wrong instructions six months after your process changed.

## What to watch before you lean on third-party skills

Anthropic's announcement flags a security guidance workstream as part of the foundation's roadmap, covering how people writing and installing skills should vet them. Details aren't published yet. Until they are, treat any skill you didn't write yourself the way you'd treat any other piece of code or automation from an external source: review what it actually instructs the AI to do before installing it broadly, especially if it touches customer data or has permission to take actions on your systems.

The planned roadmap also includes versioned releases and a formal proposal process, which should make the standard more predictable to build against over time, closer to how you'd expect an API you depend on to evolve rather than a format that could shift without warning.

## The bottom line

The headline here isn't really about Anthropic. It's that the industry just agreed a second time, after MCP, that the useful parts of agentic AI need to work the same way no matter which company's model is running underneath. If you've been holding off on documenting a repeatable workflow as a reusable AI skill because it felt like betting on one vendor, that reason just got weaker. For teams ready to go further and start designing proper agents and automations around these standards rather than one-off skills, that's exactly the ground we cover in the [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp). If you're earlier in that journey and still deciding where AI agents are worth piloting at all, our guide on [where AI agents work and how to start](/blog/ai-agents-for-business) is the right place to begin.
