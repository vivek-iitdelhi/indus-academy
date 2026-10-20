---
title: "Copilot's Agent Uploads Open to Everyone on Oct 25: Admin Checklist"
seoTitle: "Copilot Agent Uploads Open Oct 25: An Admin Checklist"
description: "Microsoft is defaulting advanced Copilot agent and plugin uploads open on October 25. Here's what IT and security leads should check first."
date: "2026-10-20"
author: "Vivek Gupta"
tags: ["AI agents", "Corporate AI training"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

If your company runs Microsoft 365 Copilot, a setting most admins have never opened is about to flip in your favor, or against you, on October 25. Microsoft has added a new control for who can upload "advanced" agents and plugins into Copilot, and if nobody in your org touches it before that date, the default becomes wide open: any user can upload one.

This is the same pattern we've seen from other AI vendors this year, Salesforce auto-enabled Agentforce for every eligible org in its Winter '27 release, and it's worth treating the same way: a "check this week" item, not a "read about it eventually" one, especially for banks, NBFCs, insurers and any company handling regulated customer data.

## What's actually changing

Microsoft's Message Center posted the change as item MC1472007, "Manage who can upload advanced agents and plugins." The detail, confirmed consistently across admin-community write-ups of the same Message Center post ([mc.merill.net](https://mc.merill.net/message/MC1472007), [msmessagecenter.com](https://msmessagecenter.com/MC1472007/), [mwpro.co.uk](https://mwpro.co.uk/blog/2026/09/15/mc1472007-microsoft-365-copilot-adds-admin-control-for-uploading-advanced-agents-and-plugins/)):

- **A new setting in the Microsoft 365 admin center**, under Copilot > Settings > All settings > Advanced package uploads, lets an AI Administrator choose who can upload advanced packages: everyone, nobody, or a specific list of users or Microsoft Entra ID groups.
- **"Advanced" has a precise meaning.** It's any package that is a declarative agent with actions, or an agent that connects to an MCP server (the protocol that lets an agent call outside tools and data sources). A declarative agent that's just instructions, with no actions and no MCP connection, counts as "basic" and isn't affected by this setting at all.
- **The default, if you don't choose, is open.** Starting October 25, 2026, advanced-package uploads turn on for all users unless an admin has already selected "no users" or a specific group.
- **Scope is limited to your own org's uploads.** This setting doesn't touch agents built by Microsoft or by third parties that your org installs from a catalog, only packages your own employees upload.

## Why "advanced" is the part worth gating

The distinction between basic and advanced isn't bureaucratic. A basic agent is prompt instructions, it can't do anything beyond generating text. An advanced agent with actions or an MCP connection can read files, call APIs, write to systems, or pull from a database your company doesn't necessarily want a chatbot touching unsupervised.

That gap is exactly where the industry's own research says the risk sits. Pynt's analysis of 281 real MCP server configurations found that 72% allow sensitive operations such as writing to disk, executing code, or calling high-permission APIs ([Pynt, "State of MCP Security"](https://www.pynt.io/blog/llm-security-blogs/state-of-mcp-security)). Separately, the Non-Human Identity & AI Journal's review of MCP server deployments found that only 18% implement any form of access scoping on what a connected tool is allowed to do ([NHIMG](https://nhimg.org/faq/what-do-security-teams-get-wrong-about-mcp-plugin-risk/)). In plain terms: most agents that get MCP access get broad access, and most organizations aren't narrowing it. An employee uploading a well-intentioned "advanced" agent to automate their own work can end up handing it more reach into company systems than anyone reviewed.

## What to do before October 25

1. **Find the setting now.** In the Microsoft 365 admin center, go to Copilot > Settings > All settings > Advanced package uploads. If you've never been there, you're not alone, this is a new control.
2. **Decide deliberately, don't default.** For most companies outside a small, trusted pilot team, "no users" or a named Entra ID group (your Copilot champions, your automation/IT team) is the safer starting point. You can always widen access once you have a review process in place.
3. **Separate this from your basic-agent policy.** If your org already lets business users build simple instruction-only agents for drafting or summarizing, that's unaffected and can stay open. This setting is specifically about the agents that can act, not the ones that only talk.
4. **If you do allow advanced uploads, pair it with a review step.** Even a lightweight one, a channel where uploaders flag what tools or MCP servers their agent connects to before it goes live, catches most of the obvious problems: an agent with write access it doesn't need, or a connection to a system outside its stated job.
5. **Check who's already uploaded something.** Advanced uploads may already be live in your tenant from earlier testing. This is a good prompt to audit what's there, not just gate what's coming.

## The pattern behind this one setting

This isn't an isolated Microsoft move. The Microsoft 365 Roadmap shows a broader push toward centralized agent governance this year: a Microsoft plugin registry is now generally available, giving IT "one place to discover, publish, manage, and govern plugins" across Copilot experiences, and Microsoft 365 E7 added Agent 365, pitched as a control plane for managing AI agents at scale ([Microsoft 365 Roadmap](https://www.microsoft.com/en-us/microsoft-365/roadmap)). Read together, the direction is clear: as agents get easier for any employee to build, vendors are building the admin controls after the fact, and shipping them turned on by default. That puts the burden on your IT and security team to go looking for the setting, rather than waiting for a prompt.

If you haven't already assigned someone to own Copilot governance, specifically who can build and upload what, this is as good a trigger as any to do it. It's a smaller lift than most AI governance work: one setting, one decision, before one date. Our [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp) and corporate [AI training](/enterprise) programs cover exactly this kind of agent governance for teams rolling out Copilot and similar tools, alongside the hands-on building skills to use them well. If you want a wider view of vendors auto-enabling agents by default, we covered the same shift at Salesforce in our piece on [Agentforce's auto-enable rollout](/blog/salesforce-agentforce-auto-enabled-admin-checklist).
