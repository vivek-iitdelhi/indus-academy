---
title: "Microsoft Rebuilt Copilot: What Home, Code and Autopilot Mean"
seoTitle: "Microsoft Rebuilt Copilot: Home, Code, Autopilot Guide"
description: "Microsoft restructured Copilot into Home, Code and Autopilot. Here's what each one does and how to prepare your team before it reaches you."
date: "2026-10-17"
author: "Vivek Gupta"
tags: ["AI tools", "Corporate AI training"]
related: "/enterprise"
relatedLabel: "Corporate AI training"
---

If your organization already pays for Microsoft 365 Copilot licenses, you've probably noticed most people only use it for drafting emails and summarizing documents. On September 25, Microsoft [rebuilt the entire Copilot app](https://news.microsoft.com/source/emea/2026/09/25/new-microsoft-copilot-brings-home-code-and-autopilot-together/) around three distinct tabs — Home, Code and Autopilot — and the gap between what you're paying for and what your team actually uses is about to get a lot more visible.

This isn't a cosmetic redesign. Each tab asks a different question of your organization: who talks to Copilot, who builds with it, and who lets it run unattended. Here's what changed, what's confirmed for this month, and what to do before it lands on your tenant.

## What actually changed on September 25

Microsoft, under Jared Spataro (Chief Marketing Officer, AI at Work), reorganized Copilot into three places instead of one chat window:

- **Home** merges Copilot Chat with the Cowork agent into a single default screen, with Word, Excel and PowerPoint built directly into the app rather than treated as separate destinations.
- **Code** lets people describe an app, dashboard or automation in plain language and have Copilot build it. It runs on the same underlying technology as GitHub Copilot, in a sandboxed environment, and can be hosted inside your own Microsoft 365 tenant rather than a third-party cloud.
- **Autopilot** is a persistent agent — an evolution of what Microsoft previously branded "Scout" — that keeps working inside Microsoft 365 without anyone actively driving it, and reports back when it has something or needs a decision.

All three are usage-based rather than flat per-seat add-ons, which means the real cost of adopting them depends on how your teams actually use them, not just how many licenses you buy. If your team already piloted Copilot Cowork, note that Home now absorbs it — our [Cowork pilot checklist](/blog/microsoft-365-copilot-cowork-pilot-checklist) on credits and governance still applies to what Home does with it.

## Code: a real on-ramp for non-developers, with real limits

This is the piece most useful to Indian teams outside IT. A sales operations analyst or an HR coordinator can describe a tracker, a dashboard or a lightweight approval workflow in a sentence and get a working tool back, without filing a ticket with IT. That matches a view I keep coming back to: you don't need to be an engineer to build something real with AI now.

The catch is governance, not capability. Because Code can be hosted inside your tenant, IT still needs to decide who can publish what, which data sources a Code-built tool can touch, and how it gets reviewed before people depend on it for real work. Treat anything built this way like you'd treat a spreadsheet macro someone wrote without telling finance — useful, but only safe once someone with context has looked at it.

## Autopilot: useful, but it needs a leash

Autopilot is the one that changes the trust conversation. An agent that keeps working after you log off is only valuable if you're confident about the boundaries it operates inside — what data it can read, what actions it can take without asking, and how you'd notice if it went wrong. Microsoft has Autopilot expanding through its Frontier early-access program rather than shipping to everyone at once, which is the right call: this is exactly the kind of feature you want a handful of trained people testing on real but low-stakes work before it touches anything customer-facing.

If you're the one evaluating it, don't start Autopilot on a process you can't fully explain to someone else. Start with something narrow and reversible — clearing a backlog of routine approvals, say — where a mistake costs you an hour, not a client relationship.

## The one PowerPoint change worth knowing this month

Separately from the September 25 overhaul, Microsoft's own 365 Roadmap lists [async notifications for the PowerPoint Copilot agent](https://mc.merill.net/message/RM570438) on web, with matching entries for [Windows desktop](https://mc.merill.net/message/RM570437) and Mac, targeted for general availability this October. In practice: you'll be able to kick off a long deck-building job in PowerPoint, close the app or switch devices, and get notified when it's done or needs your input — instead of sitting there waiting for a 40-slide draft to finish rendering. It's a small change, but if your team builds decks under deadline, it's the kind of thing that actually saves an afternoon.

## Why this matters more in India than it might look

Microsoft has been deliberately deepening its Copilot push with Indian IT services firms. In December, it [named Cognizant, Infosys, TCS and Wipro as "Frontier Firms"](https://analyticsindiamag.com/ai-news-updates/microsoft-names-cognizant-infosys-tcs-wipro-as-frontier-firms-for-copilot-deployment), with each committing to deploy more than 50,000 Copilot licenses — over 200,000 seats between them. If you work at or with one of these organizations, or any large enterprise following their lead, the Home/Code/Autopilot restructuring and early Frontier access to Autopilot are coming to your tenant on a faster timeline than the rest of the market.

That's a reason to get ahead of it rather than wait for a company-wide memo. The gap between "we have Copilot licenses" and "our team gets value from Copilot" is a training and governance problem, not a tooling one, and it only widens as Microsoft adds more surface area to the product.

## What to do this week

1. **Ask IT which Frontier features, if any, are already enabled on your tenant.** Autopilot and Code are opt-in; most organizations haven't turned them on yet.
2. **Pick one narrow, recurring task for a Code pilot** — a status tracker, a request form, a simple dashboard — and have one person build and test it before offering it to a team.
3. **Set a review step for anything Code or Autopilot produces** before it touches customer data or external communication. Humans approve; AI prepares.
4. **If you build decks regularly, check whether the PowerPoint async feature has reached your tenant** and change how your team schedules deck work around it.
5. **Revisit your Copilot usage data** before your next renewal conversation — usage-based features change what "are we getting value" actually means.

None of this requires waiting for Microsoft to finish rolling the changes out everywhere. The organizations that get ahead of Copilot's restructuring are the ones that treat it as a change management exercise now, not a software update to deal with later. If your team needs a structured way to work through that — what to pilot, how to govern it, how to measure whether it's working — that's exactly what our [corporate AI training](/enterprise) programs are built for.
