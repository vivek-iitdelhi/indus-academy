---
title: "Claude Enterprise Merges Chat and Cowork: A Checklist for Admins"
seoTitle: "Claude Enterprise Merges Chat and Cowork: Admin Checklist"
description: "Claude Enterprise now runs agentic work inside regular chat. Four cost and access settings IT and finance admins should check before rollout."
date: "2026-10-25"
author: "Vivek Gupta"
tags: ["Corporate AI training", "AI tools"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

If your company runs Claude Enterprise, someone in IT or finance is about to get an email that quietly changes how your AI bill works. On October 23, Anthropic made the [unified chat and Cowork experience](https://claude.com/resources/articles/unified-claude-enterprise) generally available for Enterprise customers, after rolling it out to individual Pro and Max users in September. The product change itself is simple. The budgeting and access questions it raises for a company footing the bill are not, and they're worth working through before your team starts using it, not after the first surprise invoice.

## What actually changed

Before this update, Claude Enterprise users picked a mode before they started: a quick chat, or Cowork for longer, file-heavy tasks that needed to keep running in the background. Now there's just one conversation. You ask a quick question and get a quick answer. Ask for something bigger, like going through a folder of vendor contracts or building a financial model, and Claude moves that work into a cloud environment and keeps running on it, even after you close your laptop. You can pick it back up later on web, desktop or mobile. Existing chats, projects, connectors, skills and plugins carry over, so nothing already built gets lost.

That sounds like a convenience upgrade, and for the end user, it is. For the person who owns the Claude budget line, it's a different kind of system than the one you priced out.

## Why this changes your AI budget, not just your workflow

A quick chat question and an agent that spends twenty minutes working through a contract folder cost very different amounts, because Claude Enterprise is priced on usage, not a flat per-seat fee for AI output. Anthropic's own announcement says agentic tasks can consume meaningfully more tokens than a simple chat. It also claims Claude Opus 5.5 costs 40% less than Opus 5 for typical workloads and Claude Sonnet 5.5 costs up to 30% less than Sonnet 5 for most work, which softens this, but doesn't remove it. The practical result: the same team that cost you a predictable amount last month can cost noticeably more this month, simply because more of their work now quietly becomes agentic instead of staying a quick chat.

This is exactly the kind of change that catches finance teams off guard, not because the product got worse, but because nobody adjusted the budget assumptions that were built around how the old, simpler version worked.

## Four settings to check before you let this roll out

Anthropic built four admin controls into this release specifically for this problem. They're in Organization settings, and they're worth setting deliberately rather than leaving on whatever ships as default:

1. **Efficient mode.** A new setting that keeps the unified chat-and-agent experience running on Sonnet and Haiku models rather than Opus. For teams whose work doesn't need the most capable model, this is the single biggest lever on cost.
2. **Model entitlements.** You can set which models each role is allowed to use. A support or operations team doesn't need the same model access as a team building complex agent workflows.
3. **Spend limits.** These apply at the organization, group and individual member level, so one team's heavy usage doesn't quietly draw down budget meant for another.
4. **Pooled group budgets.** A group can share one monthly amount, which works better than per-person limits for teams whose usage varies a lot week to week.

Go through these four before you tell your team the new experience is live, not after. Decide model entitlements by role first; that one setting does most of the work of keeping costs predictable.

## What carries over on security, and what doesn't

If your company adopted Claude Enterprise partly on the strength of its compliance posture, that doesn't change here. Single sign-on and the Compliance API still apply. Agentic work runs in isolated virtual machines with network egress off by default, and connector credentials stay outside the sandbox the agent runs in. Anthropic says it encrypts data in transit and at rest and doesn't use it to train models by default, and because agentic work now runs inside one Anthropic-managed environment, admins get central visibility into it rather than having it scattered across separate tools.

One exception worth knowing: organizations currently using zero data retention for Claude Code, a HIPAA-ready configuration, or customer-managed encryption keys stay on their current setup and aren't auto-migrated into the unified experience. If that's your company, check with your Anthropic account team on timing rather than assuming you're already on the new version.

## What to do this week

- Find out if your organization has already received Anthropic's rollout email, and if not, ask your account team when it's scheduled.
- Set model entitlements by role before rollout, not after. Decide which roles genuinely need Opus-level capability versus Sonnet or Haiku under Efficient mode.
- Put a spend limit on at least one group as a test, even a generous one, so you have a real number to compare against next month's invoice.
- Confirm with IT whether your organization falls into one of the excluded categories (ZDR, HIPAA, CMEK) and, if so, whether that's intentional.
- Pick one team to monitor closely for the first month. Compare their actual spend against what Efficient mode and their model entitlement would have predicted, and adjust from there.

This is the same pattern we've written about before with [Claude's Cowork-to-chat merge for individual users](/blog/claude-cowork-merged-into-claude-docs-slides-guide): useful capability arrives bundled with a pricing model that rewards companies who set it up deliberately and penalizes the ones who don't look until the bill arrives. If your team is piloting AI tools across departments and wants a structured way to get the budgeting and governance side right from the start, that's exactly what we work through in our [Corporate AI training](/enterprise) programs.
