---
title: "OpenAI's Data Agent: Dashboards Without Writing SQL"
description: "OpenAI's new Data agent in ChatGPT Work builds dashboards from plain questions. Here's what it does, what to check, and how to try it this week."
date: "2026-09-19"
author: "Vivek Gupta"
tags: ["AI productivity", "AI tools"]
related: "/programs/ai-generalist-certification"
relatedLabel: "AI Generalist Certification"
---

Every finance, sales and operations team has the same bottleneck: someone who knows SQL has to sit between a business question and an answer. OpenAI's new Data agent, added to [ChatGPT Work](https://enterprisedna.co/resources/news/openai-chatgpt-work-enterprise-agents-codex-july-2026/) on September 10, is built to remove that bottleneck, at least for teams whose company has already connected their data. Here's what it actually does and how to think about using it responsibly.

## What was announced

ChatGPT Work is OpenAI's enterprise platform, launched in July, where AI agents run multi-step projects rather than just answering chat questions. The Data agent is a new capability inside it: you connect your company's approved data sources, then ask business questions in plain language, and the agent investigates, builds interactive dashboards and lets you refine the analysis conversationally, without writing a query.

According to reporting on the launch, the Data agent connects to sources including Amazon Redshift, Google BigQuery, Snowflake, Databricks, MongoDB, Datadog and ClickHouse, alongside uploaded files. You can ask it to find trends or anomalies, produce a shareable summary or chart, and then ask a natural follow-up question the way you would with a human analyst, instead of starting a new query from scratch.

This is a meaningful shift from the AI-as-chatbot pattern most people are used to. Instead of pasting a spreadsheet into a chat window and asking for help, the agent works against your live, governed data source, so the numbers reflect what's actually in your systems today rather than a static export.

## Who this actually helps

The Data agent is part of ChatGPT Work, OpenAI's enterprise tier, so an individual professional can't just sign up for it the way they would for ChatGPT Plus. It's something your IT or data team has to enable and connect. That makes this a decision for whoever owns your company's AI tooling, not a personal productivity hack you can try tonight. If your company already uses ChatGPT Enterprise or is evaluating ChatGPT Work, this is worth raising with them directly this week.

Once it's connected, the people who benefit most are the ones who currently wait in a queue for a data or BI team to answer a question: sales managers who want their own pipeline cuts, finance analysts building recurring MIS reports, operations leads tracking delivery or defect trends. None of them need to learn SQL or a BI tool's query language to get an answer.

## How to evaluate it before you rely on it

Treat any AI-generated dashboard the way you'd treat a first draft from a junior analyst: useful, fast, and something you verify before you act on it.

1. **Check the source, not just the number.** Ask the agent which tables or fields it used to produce a figure. If it can't explain its source clearly, don't trust the number.
2. **Spot-check against a known answer.** Before you use it for a new question, ask it something you already know the answer to (last month's revenue, a headcount number) and confirm it matches.
3. **Watch what data it can see.** In an Indian context, data residency and access control matter as much as capability. Confirm with your IT team exactly which data sources and fields the agent has been given access to, and whether that includes anything customer-sensitive or regulated.
4. **Keep a human sign-off on anything that leaves the building.** A dashboard for your own team's planning is low-risk. A number going into a board deck, a regulatory filing or a client report needs a human who checks it before it goes out.
5. **Don't let it replace your data team's judgment on what to measure.** The agent is good at answering the question you ask. It won't tell you if you're asking the wrong question, or if a metric is misleading without more context. That's still a job for someone who understands the business.

## How to try this at work this week

If your company already has ChatGPT Work or is piloting it:

- **Pick one recurring report** you or your team builds manually every week or month — a sales pipeline summary, a weekly ops dashboard, a spend tracker — and ask the Data agent to reproduce it from the connected source.
- **Compare the output** against your manual version line by line before you trust it for anything real.
- **Time the difference.** If it saves genuine time once you've verified accuracy, that's your case for expanding its use; if it doesn't, you've lost an hour, not a quarter.

If your company doesn't have ChatGPT Work yet, this is a reasonable feature to point to when you're making the case internally for evaluating it, alongside a clear plan for who reviews the data connections and who signs off on outputs before they're used for decisions.

## The bigger pattern

This is part of a broader move by AI vendors toward "ask a question, get a governed answer" tools that sit directly on top of company data, rather than general chat assistants that need information copied in. That's a genuine productivity gain for non-technical teams, but it also means data governance and access control decisions matter more, not less, once the AI can query everything a human data analyst could. Get the access controls right before you get excited about the dashboards.

If you want a structured way to build the judgment to evaluate tools like this as they arrive, rather than adopting each one on faith, our [AI Generalist Certification](/programs/ai-generalist-certification) covers exactly that: using AI across real analysis and reporting work while knowing how to check what it gives you.
