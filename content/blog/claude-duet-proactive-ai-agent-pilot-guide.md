---
title: "Claude Duet: How to Think About a Proactive AI Agent"
description: "Anthropic's Claude Duet watches your apps and acts with approval. It's US-only for now, but here's how Indian professionals should prepare."
date: "2026-10-24"
author: "Vivek Gupta"
tags: ["AI agents", "AI productivity"]
related: "/programs/ai-automation-agents-bootcamp"
relatedLabel: "AI Automation & Agents Bootcamp"
---

Every AI assistant you've used so far waits for you to open it. On October 21, Anthropic [introduced Claude Duet](https://claude.com/resources/articles/claude-duet), a research preview that flips that model: it watches your connected apps in the background and messages you only when something needs your attention. It's a research preview for US Pro and Max subscribers on a waitlist right now, with no word yet on India, but the shift it represents, from "AI you open" to "AI that watches and flags," is worth understanding before it reaches your apps too.

## What Claude Duet actually does

Duet runs as its own app (iOS, Android, and claude.ai), separate from the regular Claude chat app, on its own virtual machine with its own browser. Because it runs in the cloud rather than on your device, it keeps working after you close your laptop. A few concrete things it does, per Anthropic's announcement:

- Sends a short morning brief covering the most important items across the apps you've connected.
- Checks those apps every few hours and messages you only when something actually needs a decision, not on a fixed schedule for everything.
- Handles work of different sizes: scheduling a meeting, building a dashboard, drafting a financial or sales forecast, or putting together a prototype.
- Connects to more than 6,000 third-party tools and plugins, including named integrations with Gmail, Slack, QuickBooks, Stripe, Gusto, LinkedIn, Docusign, HubSpot, Canva, and Shopify.
- Can complete purchases through Stripe's Link using a virtual card, or check out with Shop Pay, when you've approved that in advance.

It carries over the memory, skills, and connected apps from your existing Claude account, and you talk to it through one ongoing thread, typed or spoken, rather than starting a new conversation each time.

## The part that matters more than the feature list: the approval gate

Anthropic built Duet around a specific rule: it reads and drafts on its own, but it shows you what it plans to do before it sends a message, makes a payment, signs a document, or deletes anything, and it waits for your approval. Some actions are blocked outright regardless of approval, including trading securities or moving money between accounts. You can also disconnect any connected app at any point.

This is worth sitting with for a moment, because it's the design decision that makes a "watches everything and acts" agent something you could responsibly pilot rather than something you'd have to supervise full-time. It matches a principle worth applying to any proactive agent you evaluate, not just this one: the agent should prepare the action, and a person should approve anything that leaves the building; see the sales-agent fleet example in our [earlier piece on narrow, approval-gated agents](/blog/ai-agent-fleet-for-sales-teams-guide) for how that looks in practice on a sales team.

Anthropic also lists specific safeguards: Duet never sees your actual passwords or sign-in tokens directly, a classifier checks its actions against Anthropic's framework for trustworthy agents, and it has built-in defenses against hidden instructions buried in a webpage or document it reads (known as prompt injection). A dedicated classifier refuses to share your most sensitive details, such as card numbers or government ID, and shares health or personal finance information only when you've explicitly told it to.

## Where it's honest about not being ready

Anthropic's own announcement lists real limitations, which is worth noting because it's rare for a launch post to do that:

- It can misread a thread or misjudge what's actually urgent.
- Personal errands, like booking a ticket, are weaker than work tasks right now.
- You can't yet see its browser while it works.
- Background monitoring and larger tasks count against your normal Claude usage limits.
- Its judgment about when to interrupt you is still being tuned.

None of that is a reason to dismiss it. It's a reason to treat the first few weeks of any pilot as supervised, exactly the way you'd onboard a new hire before giving them a company card.

## What to do this week, even without access yet

Since Duet is a US-only waitlist today, with no announced plans for India, the useful move isn't signing up. It's using the gap to get ready.

### 1. List what you'd actually want watched, not acted on

Before you want an agent to do anything, you want it to notice things: a client call that overlaps with a flight, an invoice that hasn't been paid in 30 days, a lead that's gone quiet. Write down the five things in your week that you currently catch late because nothing is watching for them.

### 2. Separate "notify me" from "act for me" in your own head

Most of the value in a tool like this comes from the first category, and most of the risk comes from the second. Decide, task by task, which of your recurring work belongs in a "just tell me" lane and which belongs in an "act with my sign-off" lane, before any vendor makes that decision for you by default.

### 3. Audit what you'd be willing to connect

Duet's connector list includes your email, your CRM, and your accounting and payments tools. Before connecting any of those to any proactive agent, ask what data it can see, whether it's used to train models (Anthropic says it isn't, by default, on paid plans), and whether you can disconnect it cleanly. Do this audit now, for whichever AI tools you already use, so you're not doing it under time pressure later.

### 4. Practice the review habit now, with what you already have

You don't need Duet to practice reviewing AI-drafted work before it goes out. If your team already uses Claude or ChatGPT to draft emails, proposals, or reports, build the habit of a quick human check before anything sends, exactly the approval step Duet is designed around. That habit, not the specific product, is what will make piloting any proactive agent safer when one does reach your market.

Proactive, approval-gated agents are a sensible direction, not a gimmick, and Duet is a clear example of what good guardrails on one look like. If your team is building toward using agents like this across real workflows, our [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp) covers how to design the approval and oversight layer, not just the automation.
