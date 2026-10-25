---
title: "Before You Build an AI Agent Team, Read This"
description: "Most teams overbuild AI automations with too many specialist agents. Anthropic's own guidance on when one agent beats many, made practical."
date: "2026-10-25"
author: "Vivek Gupta"
tags: ["AI automation", "AI agents"]
related: "/programs/ai-automation-agents-bootcamp"
relatedLabel: "AI Automation & Agents Bootcamp"
---

Give a team a taste of AI agents and a common thing happens next: they build one for every department. A sales bot, a finance bot, a support bot, and a "coordinator" bot to manage the other three. It feels like good design, mirroring how the company itself is organized. On October 22, Anthropic's own engineering team [published a detailed piece](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop) arguing that this instinct is usually wrong, and worth reading before your team builds its next automation, not after it's already slow and expensive to run.

## The mistake: one bot per team

The appeal of splitting an AI system into specialist "subagents" is obvious. Each one gets a narrow job and simple instructions, which feels cleaner than one agent trying to do everything. The problem, according to Anthropic's own account of building these systems, is that each handoff between agents loses information, the way details get lost passing a message down a line of people. One company they describe found that a dozen specialist subagents made it hard to keep a consistent voice across customer interactions and added enough latency to hurt the experience. In a direct comparison on another system, a single well-built agent ran roughly twice as fast as the multi-agent version doing the same job.

The structure that causes this is easy to recognize because it's so common: an intent classifier at the front, a fixed decision pipeline, separate branches for different customer segments, and an orchestrator stitching it all together. It looks thorough. It's usually solving a problem that didn't need that much machinery.

## Start with one agent, not many

Anthropic's recommended default is one capable agent with a clear set of instructions, a small number of simple tools, and reference material it only pulls up when it actually needs it, rather than loading everything into every conversation. That last part, often called progressive disclosure, matters more than it sounds: the agent sees short descriptions of what's available and fetches the full detail only for the task in front of it, instead of carrying every possible instruction into every task.

A single agent has three concrete advantages over a team of them. It keeps everything it has learned in one place, so it can connect something it noticed early in a task to a decision it makes later. It needs fewer handoffs, so less gets lost along the way. And it's simpler to upgrade when a better model comes along, since you're not re-tuning how five agents talk to each other.

The tradeoff is discipline, not simplicity. Someone has to own the main instructions and keep them from turning into a pile of contradictory rules added by whoever touched the system last. Anthropic calls this "instruction creep," and it's the real reason single-agent systems eventually get split up, not because the single-agent idea failed.

## When you genuinely do need more than one agent

There are real signals for when to add a second agent, and they're worth watching for rather than guessing at upfront:

- **Your agent is visibly worse because it's carrying too much.** If instructions and context have piled up to the point where quality measurably drops, that's a real reason to split work off.
- **You have genuinely independent tasks that can run at the same time.** Work that needs a fresh start each time and gets discarded afterward is a good candidate for a separate, parallel agent.
- **The agent keeps picking the wrong tool, or its own instructions contradict each other.** Anthropic's guidance notes that tool selection tends to degrade once an agent has more than roughly 30 to 50 tool definitions in play, so group tools by what the user is trying to accomplish rather than giving the agent one tool per system feature.

Notice what's not on that list: "it feels more organized this way," or "it matches our org chart." Neither of those is evidence the system needs it.

## How to test this before you build anything bigger

You don't need a formal evaluation framework to apply this. Anthropic's own suggestion is a small set, about 10 realistic examples with known good answers, that you run every time you change the instructions. Run each test more than once, since some failures only show up occasionally rather than every time. Change one thing at a time so you know what actually caused an improvement or a regression, and when you simplify a system, specifically check that steps it used to handle correctly, like confirming a delivery date before replying, still work after the change.

This is the same start-narrow-then-scale approach worth applying to any AI rollout: pick one real workflow, measure it before and after, and only add complexity when the measurement tells you to.

## This week's checklist

- **Before building anything new,** write down the single clearest version of the task in plain instructions, pick three or four tools it actually needs, and try that first.
- **Assign one owner** for the main instructions, even if several people contribute ideas to it.
- **Write 10 test examples** from real work your team has already done, with the answer you'd consider correct.
- **Only split into a second agent** when you can point to a specific test result that got worse, not a hunch that it should be organized differently.
- **If you already have a sprawling multi-agent setup,** try collapsing it back to one agent against your test set before assuming it needs to stay complex.

It's worth saying clearly: sometimes several narrow agents genuinely is the right answer. We've written before about [an Anthropic sales rep who built six small agents](/blog/ai-agent-fleet-for-sales-teams-guide), each with exactly one job, that together saved him real time. The difference is that each of those six had a distinct, parallel task with a clear owner reviewing the output, not a mirror of an org chart built on instinct. If you're automating a call-heavy or chat-heavy workflow and want it built right the first time, our sister company [IndusLabs](https://induslabs.io) builds voice AI and workflow automation for Indian businesses, and this exact question, one agent or several, is usually the first thing worth getting right. For a structured way to learn how to build and scope these systems yourself, our [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp) covers it in depth.
