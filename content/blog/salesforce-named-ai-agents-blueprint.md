---
title: "Salesforce's Named AI Agents: A Blueprint for Your Team"
description: "Salesforce gave its AI agents names, jobs and guardrails. Here's the practical framework Indian teams can copy when designing their own agents."
date: "2026-09-16"
author: "Vivek Gupta"
tags: ["AI agents", "AI automation"]
related: "/programs/ai-automation-agents-bootcamp"
relatedLabel: "AI Automation & Agents Bootcamp"
---

On September 11, Salesforce announced an expanded lineup of AI agents inside Agentforce, and this time each one has a name and a job title: [Salesforce's announcement](https://www.salesforce.com/news/stories/agentforce-job-ready-ai-agents/) describes Casey (customer service), Paige (IT and HR support), Carter (shopping assistant), Hunter (outbound sales), Marshall (supply chain and back-office), Piper (inbound lead qualification) and Fin (customer experience). You don't need to be a Salesforce customer to learn something from how these agents are built. The design choices behind them are a useful checklist for any team in India building or buying an AI agent this year.

## What Salesforce actually announced

Each of the seven agents is scoped to one function rather than being a general assistant. Casey resolves service issues across voice, SMS, WhatsApp and web chat, with prebuilt handling for FAQs, returns and account management, and hands off to a human when it can't help. Paige handles IT and HR requests through Slack and internal portals. Marshall runs back-office and supply chain processes with what Salesforce calls deterministic execution and an audit record of every action. Hunter, the outbound sales agent, is the most ambitious: it works a pipeline over weeks and months and is currently in pilot, with general availability planned for November 2026, according to the same announcement.

The same week, OpenAI opened its own [Agents API in public beta](https://www.marktechpost.com/2026/09/10/openai-launches-the-agents-api-in-public-beta-putting-the-codex-harness-behind-one-api-call/), giving any developer the orchestration, long-running sessions and tool-calling that used to be locked inside Codex. Two large vendors moving in the same direction in the same week isn't a coincidence. It confirms where the industry is placing its bets: narrow, well-defined agents with real guardrails, not one do-everything assistant.

## The pattern worth copying

Strip away the branding and four design choices repeat across every credible agent launch this year, Salesforce's included.

1. **A narrow job, not a general mandate.** Every one of the seven agents does one thing. Casey doesn't also try to close sales, and Hunter doesn't also handle support tickets. When you scope an agent to a single, repeatable workflow, you can actually test it against real examples before trusting it.
2. **Memory that matches the job.** Hunter needs to remember a prospect's history over months to run an outbound campaign. Casey mostly needs the current conversation and the customer's account. Give an agent only as much memory as its job requires; more memory means more that can go stale or leak.
3. **Guardrails defined before launch, not after a mistake.** Salesforce's [Trust Layer](https://www.salesforce.com/welcome-to-the-agentic-enterprise/ai-guardrails/) sets out data masking, role-based access, and toxicity checks as standard, not optional, features. Whatever platform you use, decide upfront what data the agent can see, what actions it can take without approval, and what topics are out of bounds.
4. **A clear escalation point.** Every one of these agents is designed to hand off to a person when a decision exceeds its authority — a refund above a threshold, a legal question, an angry customer. The escalation rule is part of the agent's design, not an afterthought bolted on when something breaks.

## Applying this without Salesforce's budget

Most Indian businesses evaluating agents aren't choosing between Salesforce products; they're deciding whether to buy a vertical agent, build one with a no-code tool like n8n or Zapier, or have a developer wire one up with an LLM API. The same four questions apply regardless of the stack:

- What is the one workflow this agent owns, and what does it explicitly not do?
- What data does it need to see, and where does that data live — especially if it touches customer PII under the DPDP Act?
- What can it do on its own, and what needs a human to approve first?
- Who does it hand off to, and under what conditions?

Write the answers down before you write a single prompt or workflow step. Teams that skip this step end up with an agent that technically works in a demo but can't be trusted with real customers, because nobody decided in advance what "trusted" means for that job.

## Where this still needs a human

Salesforce's own language is instructive: Hunter is in pilot, not general release, and it's the agent with the longest time horizon and the least direct supervision. That's the right order of caution. Give agents with tight, short-cycle tasks — answering a known set of questions, drafting a first pass at a document, routing a request — more autonomy sooner. Give agents with long time horizons and real financial or reputational consequences a pilot phase with a human checking every output before you loosen the leash.

It's also worth being honest that named agents and slick demos don't remove the hard part: getting the agent's outputs right on your specific data, in your specific workflow. A supply chain agent that works beautifully on Salesforce's demo data still needs weeks of testing against your actual vendor list, your actual exceptions, and your actual edge cases before it earns unsupervised access.

## A short checklist before you start

- Pick one workflow, not a department.
- Define the agent's job in one sentence a colleague could repeat back to you.
- List the data it needs, and only that data.
- Write the escalation rule before you write the automation.
- Test on real, messy examples from the last month, not clean sample data.

If you're building your first agent and want a structured way to go from workflow to working pilot, our [AI Automation & Agents Bootcamp](/programs/ai-automation-agents-bootcamp) walks through exactly this process with tools most Indian teams already have access to.
