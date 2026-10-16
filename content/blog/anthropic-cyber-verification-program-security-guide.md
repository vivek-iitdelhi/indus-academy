---
title: "Anthropic's Tiered AI Access: A Model for Your Security Team"
description: "Anthropic now gives verified security teams three tiers of AI access instead of one on/off switch. Here's the model, and how to copy it internally."
date: "2026-10-16"
author: "Vivek Gupta"
tags: ["AI consulting", "Corporate AI training"]
related: "/programs/ai-for-leaders"
relatedLabel: "AI for Leaders"
---

Most companies handle AI and security work with a single switch: either employees can use AI models for security tasks, with whatever restrictions the vendor built in for everyone, or security leadership blocks it outright and hopes nobody routes around the block. Anthropic's expanded [Cyber Verification Program](https://www.anthropic.com/news/cyber-verification-program), announced on October 6, replaces that single switch with three tiers of access, each with its own eligibility bar and its own guardrails. Whether or not your team ever applies to it, the structure itself is worth studying, because it's a more honest way to manage AI access than the all-or-nothing approach most companies default to.

## What Anthropic actually built

The program merges two earlier offerings, Project Glasswing and the original Cyber Verification Program (CVP), into three tiers, all built on Claude Opus 5.5, Claude Sonnet 5.5 and Claude Mythos 5.1:

- **Defense Access** is for security teams defending systems they own: company security teams, universities, government bodies, critical infrastructure operators like hospitals or municipal utilities, smaller security firms, open-source maintainers, and individual researchers with a track record of responsibly reported vulnerabilities. It covers security operations, incident response, malware reverse-engineering, and vulnerability analysis. Anthropic says it reviews applications within a few days. Guardrails still apply: in Anthropic's own CyScenarioBench test, 46 of 50 trials were blocked at some point even at this tier.
- **Red Team Access** adds authorized penetration testing and red-teaming on top of Defense Access, for in-house red teams, government red teams, and security or pen-testing firms. Anthropic is explicit that "this tier is for organizations only; individual researchers are not eligible." Testing is limited to systems the organization is authorized to test, and real-time blocks remain for anything that could cause physical harm or mass disruption, such as deploying ransomware or testing high-risk safety systems. Review takes a few weeks, and applicants are enrolled in Defense Access while that review runs.
- **Specialized Access** has the fewest restrictions of the three and is reserved for organizations authorized to test genuinely safety-critical systems: flight operating systems, power grids, telecom networks, interbank transfer infrastructure, government administrative networks. Anthropic reviews every applicant here "in depth in collaboration with the US government."

Generally available Claude models, outside this program, keep conservative cyber safeguards by default. They're still fine for code review, patching known issues, finding vulnerabilities in your own source code, and triaging alerts. CVP exists for the harder, more adversarial work that those defaults are deliberately built to slow down.

## Why the tiering matters more than the access itself

The specific capabilities here are built for professional security teams, and most Indian companies won't apply. What's genuinely useful, even if you never touch the CVP portal, is the underlying design: access scales with verification, not with how senior the person asking is or how persuasive the request sounds.

That's a direct answer to a problem every security and IT leader managing AI rollouts in India already has. Your company almost certainly has a mix of AI access right now: some teams with full, unrestricted use of a coding assistant or a chat tool, others blocked from AI entirely because nobody wanted to make the judgment call, and a frustrated middle who route around both. A tiered structure, verified eligibility criteria, scoped capability per tier, and a visible review process, is a workable way to close that gap without defaulting to "everyone" or "no one."

## How to build your own version of this internally

### 1. Define two or three tiers for AI access in your company, not one

Most companies only have "approved tool" and "not approved." Add a middle tier: elevated access (broader data access, fewer content restrictions, agentic/autonomous use) available only to named, verified individuals or teams, with its own sign-off.

### 2. Tie each tier to a verification step, not a title

Anthropic verifies organizations and, for individuals, a track record of responsible vulnerability disclosure, not seniority. Do the same internally: a developer gets elevated AI access because they've completed your secure-coding review process, not because they're a manager. This also gives you a defensible answer when someone asks why they don't have access yet.

### 3. Keep real-time blocks on the handful of actions that are never worth the risk

Even Anthropic's least-restricted tier keeps hard blocks on things like ransomware deployment and testing safety-critical systems without authorization. Decide, for your own AI tools, what the equivalent short list is for your company, actions no verification level should unlock, such as an AI agent approving a wire transfer or deleting production data, and build that as a hard stop rather than a policy document people are trusted to remember.

### 4. Set a review timeline you'll actually stick to

Anthropic promises days for the lowest tier and weeks for the higher ones. Whatever you promise internally for upgrading someone's AI access, make it a real SLA your IT or security team tracks, not an open-ended "submit a ticket." A tiered system that takes months to move someone up a tier just pushes people back toward routing around it.

## If you do want to apply

If your organization genuinely does security operations, incident response or authorized penetration testing, and wants reduced restrictions on Claude for that work specifically, Anthropic's application is at its CVP portal, and existing Project Glasswing members are automatically moved into the equivalent new tier. Confirm with whoever owns your cloud and security vendor relationships whether this is worth pursuing before November's broader usage-policy changes (see [our checklist on that update](/blog/claude-usage-policy-update-business-checklist)) take effect, since both land around the same time.

## The bottom line

You don't need Anthropic's exact tiers or its specific capabilities to take something useful from this. You need the principle: access to powerful AI tools should scale with how well you can verify who's using it and what for, not with a single company-wide switch. If your organization is still on that single switch, this is a good week to start sketching the two or three tiers that would actually fit how your teams work. Our [AI for Leaders](/programs/ai-for-leaders) program covers exactly this kind of structured AI governance, built in from the start rather than retrofitted after an incident.
