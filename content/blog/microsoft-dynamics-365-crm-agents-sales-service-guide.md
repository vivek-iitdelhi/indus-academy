---
title: "Microsoft's New CRM Agents: A Pilot Guide for Sales and Service"
seoTitle: "Microsoft's New CRM Agents: A Pilot Guide"
description: "Microsoft added agents across Dynamics 365 sales and service on Oct 8. Here's what's ready to pilot now, what's still in preview, and how to start."
date: "2026-10-12"
author: "Vivek Gupta"
tags: ["AI agents", "AI automation"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

If your sales or customer service team runs on Microsoft Dynamics 365, you got a long list of new AI features on October 8 — and most of it isn't available to everyone yet. [Microsoft announced a set of agents](https://www.microsoft.com/en-us/microsoft-365/blog/2026/10/08/bringing-crm-into-the-flow-of-work-and-agents-into-business-process-for-sales-and-service-teams/) that work inside Teams, Outlook and the rest of Microsoft 365, aimed at sales and service work specifically. Before you pilot any of it, it's worth knowing exactly what's generally available, what's locked to a private preview, and what starts costing you credits next month.

## What Microsoft actually announced

The release, from Microsoft's Jeff Teper, covers five pieces:

- **30 new Copilot skills** for Dynamics 365 Sales, Customer Service and Customer Insights, usable inside Copilot Cowork, Autopilot and Code, and available to custom agents built on Dynamics 365 MCP servers.
- **Dynamics 365 CRM in the flow of Teams**, which connects a Teams channel to a customer account so agents can post pre-meeting briefs, case notifications and account updates directly where sales and service teams already work.
- **Work IQ in Teams**, combining Dynamics 365 business data with Microsoft 365 workplace data inside Teams.
- **Service Agent in Microsoft 365**, which gives account managers and subject-matter experts the ability to help customers from Outlook, Teams, Word, Excel and PowerPoint — drafting responses for approval, creating CRM cases when something needs formal tracking, and handling or escalating after-hours issues, with manager visibility into what it did.
- **Sales Development Agent**, which researches prospects, personalizes outreach, manages follow-ups, nurtures early leads and hands qualified opportunities to human sellers. It runs from its own Exchange account and connects to major CRM platforms, not just Dynamics 365.
- **Dynamics 365 Activate**, which analyzes an existing CRM environment (with customer authorization) and recommends a migration path into Dynamics 365.

Microsoft also pointed to early results from customers: BNY using the Teams-based customer view across sales and service, Grupo Águia Branca reducing collaboration friction with Service Agent, Adobe generating meetings with over 10 new customers through Sales Development Agent, and Comcast using Dynamics 365 Activate to assess a migration from Salesforce.

## Check availability before you plan a pilot

This is the detail most write-ups skip, and it's the one that decides what you can actually test this quarter:

| Feature | Status as of October 8, 2026 |
|---|---|
| Copilot skills in Cowork | Generally available |
| Copilot skills in Autopilot | Private preview |
| Copilot skills in Code | Frontier Program only |
| Dynamics 365 CRM in Teams | Public preview |
| Service Agent in Microsoft 365 | Private preview, select Frontier customers only |
| Sales Development Agent | Public preview; starts consuming Copilot credits on November 16, 2026 |
| Dynamics 365 Activate | Public preview |

Two things matter here for planning. First, Service Agent is not something most teams can touch yet — it's gated to Microsoft's Frontier Program, so don't build a Q4 plan around it until that changes. Second, Sales Development Agent is open to try now but will start billing against your Copilot credits from November 16. If you pilot it before that date, treat the pilot period as a free trial window, not a permanent cost baseline — measure what it does in that window, then decide if the credit cost is worth it once billing starts.

## How to sequence a pilot, by role

**If you lead a sales team:** Start with the 30 Copilot skills in Cowork, since they're generally available and lower-risk — they're skills your team invokes, not an autonomous agent acting on its own. Use the next few weeks to pilot Sales Development Agent on a single, well-defined segment (say, inbound leads from one product line) before November 16, so you have real numbers on meetings generated and lead quality before the credit cost kicks in. Don't roll it out company-wide yet; Adobe's quoted result is "10+ new customer meetings," which is a promising signal from one customer, not evidence of what it'll do for your pipeline.

**If you lead a customer service team:** Service Agent isn't available to you unless you're already in Microsoft's Frontier Program — ask your Microsoft account team for frontier program status before planning around it. In the meantime, the Dynamics 365 CRM in Teams feature is in public preview and solves a smaller but real problem: agents who've worked a case have to leave their inbox to check CRM context. Pilot that first with one support queue, and measure whether response time or first-contact resolution improves before expanding.

**If you're migrating off another CRM:** Dynamics 365 Activate is worth a look regardless of your sales or service pilots, since it's a diagnostic tool, not a workflow change — it analyzes your current setup and tells you what a move would involve, with no commitment. Comcast's use of it to assess a migration from Salesforce is the kind of use case it's built for.

## Govern before you scale

Every one of these agents, once it's acting inside Outlook, Teams or your CRM, needs the same governance question answered: who can see what it did, and who approves what it's about to do? Microsoft routes this through Agent 365 for organization-wide management. Before any pilot goes past a single team, confirm with IT or security that Agent 365 (or your existing data governance framework) actually covers these new agents — a pilot that works well on paper but has no audit trail is not ready to scale, whatever the demo showed. This is the same pattern we described when Salesforce gave its own agents names and defined jobs: naming or badging an agent is not the same as governing it. If you haven't read that piece, our [blueprint for evaluating named AI agents](/blog/salesforce-named-ai-agents-blueprint) covers the same questions from a different vendor's angle.

## The takeaway

Microsoft shipped a lot on October 8, but almost none of it is "turn it on company-wide this week." The practical move is narrower: pick the one feature that's generally or publicly available and maps to a real bottleneck on your team, pilot it on a single queue or segment, measure it against what you do today, and only then decide whether to push further — before the Sales Development Agent's free window closes on November 16. If you're building out a broader agent rollout across sales, service and other functions, that's the kind of structured pilot-to-scale work we help teams plan through [Corporate AI training](/enterprise).
