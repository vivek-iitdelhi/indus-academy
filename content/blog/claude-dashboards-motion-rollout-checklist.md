---
title: "Claude Dashboards and Motion: A Team Rollout Checklist"
description: "Claude can now build live dashboards from your company data and turn reports into short animations. What to check before your team turns it on."
date: "2026-10-14"
author: "Vivek Gupta"
tags: ["AI tools", "Corporate AI training"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

An analyst asks Claude, in plain English, how this quarter's regional sales compare to last quarter's. Instead of a paragraph of numbers, they get a chart that updates as the underlying data changes, and they can click any number to see the exact query behind it. That's **Claude Dashboards**, one of two features Anthropic [announced on October 8, 2026](https://claude.com/resources/articles/dashboards-and-motion), alongside **Claude Motion**, which turns a prompt into a short animated explainer.

Both are in beta, both touch real company data or get shared outside your organization, and both are things an admin has to decide to switch on. Before your team turns them on, it's worth fifteen minutes to know exactly what you're enabling.

## What launched, and who gets what

Per Anthropic's announcement:

| Feature | What it does | Who has access |
|---|---|---|
| Claude Dashboards | Builds a live dashboard from a plain-language question | Beta, on Pro, Max, Team and Enterprise |
| Claude Motion | Builds a short animated explainer from a prompt | Beta, Team and Enterprise only |
| Docs, Slides, Design | Document and slide creation inside Claude | Out of beta, available on every plan including Free |

For Enterprise accounts, both Dashboards and Motion are off by default. An admin has to turn them on under Organization settings > Artifacts.

## Claude Dashboards: what it actually connects to

Dashboards works by connecting Claude to a data source and letting you ask questions instead of writing queries. Anthropic lists connectors for **Amazon Redshift, BigQuery, ClickHouse, Databricks and Snowflake**, plus CRM tools like **Salesforce**. The company says other connectors also work beyond that list.

Two details matter more than the headline feature:

- **Every number is traceable.** Clicking a chart shows the query that produced it and when it last refreshed. That's the difference between a dashboard you can defend in a leadership review and a chart you're quietly hoping is right.
- **It's built for exploratory questions, not your system of record.** Anthropic positions it for quick, ad hoc questions. Sharing to proper BI tools like Grafana, Hex, Mixpanel, Sigma and Perplexity is already available; sharing to Looker and Tableau is listed as "coming soon." If your organization already runs its numbers through Tableau or Looker, treat Claude Dashboards as a faster first look, not a replacement for the dashboard your finance team signs off on.

## Claude Motion: what it actually does

Motion builds an animation from a prompt by having Claude write code that animates text, charts, shapes and images, not by generating video footage. Anthropic is explicit that it "does not use a video generation model," so there's no AI-generated footage or AI-generated people in the output, just an editable, code-based animation you can tweak and export as an MP4.

That matters for a very ordinary reason: it's easier to trust and easier to correct. If a number in the animation is wrong, you (or Claude) can fix the underlying code rather than regenerating a whole clip and hoping it comes out right the second time.

**Where this is genuinely useful:** a trainer building a 60-second explainer for a new process, a product manager turning a quarterly chart into something that plays in a town hall instead of sitting in a static slide, an HR team animating a benefits walkthrough for new hires. None of these need a video editor on staff.

## A rollout checklist before you say yes

If you're the one deciding whether to switch this on for your team, go in this order:

1. **Pilot with one team, not the whole org.** Pick the team with the most recurring reporting pain, finance or sales operations is the usual candidate, and let them try Dashboards against a connector you're comfortable exposing, before extending access further.
2. **Review what gets connected before you connect it.** BigQuery and Salesforce access means Claude can see real customer and financial data. Confirm with IT which connectors are actually necessary for the pilot, and don't connect more than that.
3. **Check your data residency and client-contract obligations.** Indian companies in BFSI, healthcare or anyone handling regulated client data should confirm with their compliance team whether connecting Claude to a data warehouse or CRM is consistent with existing data-handling commitments, the same review this blog has flagged for other agentic features.
4. **Decide who can share externally.** A dashboard or an exported MP4 animation can leave the organization easily. Set expectations on review before anything built this way goes to a client or outside the company.
5. **Keep your existing BI tool as the source of truth.** Until Looker and Tableau sharing ships, treat Claude's dashboard as a fast exploratory view, and reconcile anything that's going into a board pack against your actual BI system.
6. **Start the Motion pilot with internal content.** Try it first on an internal training video or a town-hall explainer before using it for anything client-facing, so your team gets a feel for where the editable-animation approach works well and where it doesn't.

## How this compares to other "ask your data a question" tools

This isn't the first attempt at letting a chatbot answer business questions directly from your data. We covered [OpenAI's Data Agent](/blog/chatgpt-work-data-agent-dashboards-guide) doing something similar earlier this year. The common thread across both: these tools are genuinely faster than writing SQL for a one-off question, and genuinely risky if you treat their output as audited fact without checking the query behind it. The skill that matters is the same one either way, knowing which questions are safe to explore quickly and which numbers need a human to verify before they go anywhere official.

## The takeaway

Try Dashboards on one recurring question your team re-asks every week, and try Motion on one internal explainer you'd otherwise have built as a static deck. If either saves real time, roll it out deliberately, with the checklist above, rather than switching it on for everyone at once. If your organization is weighing which of this wave of AI features is actually worth adopting company-wide versus which is just noise, that's the kind of decision our [corporate AI training](/enterprise) programs are built to help leadership teams make.
