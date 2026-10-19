---
title: "Salesforce Turns On AI Agents by Default: What Admins Must Check"
seoTitle: "Salesforce Turns On AI Agents by Default: Admin Checklist"
description: "Salesforce's Winter '27 release auto-enables Agentforce in every eligible org. Here's what IT and ops leaders need to check before it reaches their team."
date: "2026-10-19"
author: "Vivek Gupta"
tags: ["AI agents", "Corporate AI training"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

If your company runs Salesforce, AI agents are about to show up in your org whether or not you asked for them. With the Winter '27 release, which reached general availability on October 12, Salesforce is auto-enabling Agentforce, its AI agent platform, for every org that already has Agentforce access through its license, edition or add-on SKU. New orgs get it switched on the moment they're created. Existing orgs are being turned on in a rolling rollout that started the first week of September. No one has to click "enable" anymore, and no one is asking permission first.

That's a meaningful shift from how most companies have treated AI tools so far: something you opt into after an evaluation, a pilot and a decision. Here, the default has flipped. If you manage a Salesforce instance for an Indian company, whether that's a 50-person startup or a large BFSI or retail operation, this is a "check this week" item, not a "read about it eventually" one.

## What's actually changing

A few concrete facts, drawn from Salesforce's own release notes and reporting from Salesforce-focused outlets like [Salesforce Ben](https://www.salesforceben.com/salesforce-to-auto-enable-agentforce-in-winter-27-what-that-means-for-you/) and [Citrin Cooperman](https://www.citrincooperman.com/In-Focus-Resource-Center/Salesforce-Winter-27-Core-Platform-Flow-and-Sales-Cloud-Upgrades):

- **Enablement is automatic, not optional.** Any org with Agentforce access through its licensing is being enabled, existing orgs on a rolling schedule, new orgs instantly.
- **The off-switch is going away.** The toggle that used to sit on the Agentforce Agents page in Setup is being removed from Setup entirely as part of this release.
- **It doesn't cost more on its own.** Salesforce says enablement carries no additional licensing fee and no change to your existing bill. Usage of specific agent actions may still carry its own cost depending on your plan.
- **Access isn't automatically granted to every user.** Agentforce being "on" for the org is different from every employee being able to build or run agents. Non-admin users still need the Manage AI Agents permission explicitly assigned. The Einstein Generative AI setting also has to be enabled for anyone to use Agentforce Builder.
- **Financial Services Cloud customers are on a separate, faster clock.** Agentforce for Financial Services Cloud is moving into production orgs in specific upgrade windows, including October 2, 9 and 10. If you're in BFSI, check your org's scheduled window now, not after it happens.

The practical upshot: the platform-level switch is being made for you, but the permission-level switch for individual employees is still yours to control. That distinction is where your next week of work should go.

## Why "no extra cost" doesn't mean "no extra risk"

It's tempting to read "no billing change" as "nothing to worry about." That's the wrong read. Agentforce ships with real capabilities, reading and acting on your CRM data, calling tools, executing flows, and its guardrails are configurable, not fixed. Two details matter more than the billing line:

1. **Data masking is off by default for Agentforce use cases.** Salesforce's own documentation on the [Einstein Trust Layer](https://www.salesforce.com/blog/llm-data-masking/) notes that pattern- and field-based masking, which would normally hide sensitive values before they reach a model, is disabled specifically for Agentforce, because masking adds latency and interferes with an agent's ability to plan and act. Masking still applies to other generative features outside Agentforce. If your org stores customer PII in fields an agent can touch, that's worth knowing before an agent starts running, not after.
2. **Agents inherit your existing permission structure, for better and worse.** An agent built on top of a user's session generally respects Salesforce's role hierarchy, permission sets and field-level security. That's good news if your access controls are already tight. It's bad news if they've drifted over the years, because an agent will now act with whatever access that drift left in place.

For Indian companies handling customer data under the DPDP Act, both points deserve a specific look this week rather than a general "we'll review AI governance next quarter."

## A checklist before Agentforce reaches your org

1. **Find out if you're already enabled.** Check Setup for Agentforce status, or check your org's scheduled enablement date against Salesforce's published rollout communications. If you're in Financial Services Cloud, confirm your specific upgrade window.
2. **Audit who has the Manage AI Agents permission.** Don't assume it's narrowly assigned. If it was given out during an earlier pilot or demo, check whether those grants are still appropriate.
3. **Review what data your agents can see.** Map which objects and fields Agentforce agents can access given your current permission sets, with particular attention to anything containing customer PII, financial details or health information.
4. **Set approval thresholds for consequential actions.** Agentforce's low-code guardrails let you restrict which tools and actions an agent can call, which domains it can reach, and what requires human sign-off before execution. Decide this explicitly rather than leaving defaults in place.
5. **Turn on logging and review it.** Interactions with Agentforce agents are logged; make sure someone on your team is actually looking at those logs on a schedule, through Security Center or Shield if you have it, rather than treating logging as a box already ticked.
6. **Brief whoever owns your Salesforce relationship.** If you use a partner or systems integrator to manage your org, confirm they know this change is rolling out and have already walked through points 1 to 5 with you.

None of this requires blocking Agentforce outright. For a lot of teams, the agent capabilities are genuinely useful once scoped correctly, closer to the pattern we covered when [Salesforce launched its named agents](/blog/salesforce-named-ai-agents-blueprint) back in September. The point is that "useful" and "safe by default" are two different claims, and this release only guarantees the first one.

## The bottom line

A platform you already pay for just turned on an AI agent layer across your org, and the manual off-switch is disappearing. That's not a reason to panic, but it is a reason to spend an hour this week confirming who can build agents in your org, what data they can touch, and what still needs a human's sign-off before it runs. Companies that treat AI governance as something built into the rollout, not bolted on after an incident, are the ones that get to keep using these tools without a scare. Our [Corporate AI training](/enterprise) programs help operations and IT teams build exactly that kind of governance alongside the rollout, instead of writing the policy after the agents are already live.
