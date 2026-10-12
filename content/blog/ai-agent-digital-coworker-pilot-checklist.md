---
title: "AI Agents With Their Own Email Address: A Leader's Checklist"
description: "Google, Microsoft and OpenAI each gave AI agents a persistent identity this month. What that changes, and five questions to ask before you pilot one."
date: "2026-10-12"
author: "Vivek Gupta"
tags: ["AI agents", "Corporate AI training"]
related: "/programs/ai-for-leaders"
relatedLabel: "AI for Leaders"
---

In the space of two weeks, three of the biggest AI companies in the world shipped the same idea: an AI agent that doesn't just answer you in a chat window, but gets its own email address, its own calendar and a listing in your company directory, like a new hire. If you lead a team that's thinking about piloting AI agents, this is the detail worth pausing on, more than any benchmark score.

## What just happened, in three announcements

Within a span of about two weeks, three separate companies previewed a version of the same thing: a persistent agent that acts like a member of staff rather than a tool you open and close.

- **Google Cloud's Gemini agent**, unveiled at its "Gemini at Work" event on October 8, lets a business set up a "coworker" agent by describing its role. According to [TechRepublic's coverage](https://www.techrepublic.com/article/news-google-gemini-agent-workplace-apps/), that agent then gets its own Workspace account, an email address, a calendar, Drive storage and a slot in the company directory, and can be @mentioned in Chat or tagged in a Doc comment like any colleague. It's in private preview and routes work across Google's Gemini models and Anthropic's Claude models.
- **Microsoft's Autopilot**, part of a rebuilt Copilot app unveiled on September 25, is described by [GeekWire](https://www.geekwire.com/2026/microsoft-unveils-all-in-one-copilot-app-taking-on-anthropic-and-openai-in-new-push-to-boost-adoption/) as a persistent agent that lives inside your company's own tenant, with its own identity and memory, and that your team can address in Teams, Outlook or a document the same way they'd address a person. It's moving into private preview, with wider availability expected around Microsoft's Ignite conference in November.
- **OpenAI's Dots**, launched at DevDay on September 29, are described by [TechCrunch](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/) as always-on agents that each get their own cloud computer and keep working on a goal after you've logged off, connecting to thousands of apps through OpenAI's plugin ecosystem. OpenAI is previewing enterprise versions with their own credentials and system access, on top of the version rolling out to Pro and Business Premium ChatGPT subscribers.

None of this is generally available yet, and none of the three companies has published full India pricing or a firm rollout date here. But the direction is clear enough that it's worth planning for now, not after it lands in your inbox as a vendor pitch.

## Why a mailbox changes the calculus

An AI agent that only responds when you prompt it is easy to reason about: you ask, it answers, you check the answer, nothing happens without you. An agent with its own email address, calendar and directory listing is different in kind, not just degree. It can receive messages, get invited to meetings, and act on a standing instruction for hours or days without anyone re-approving each step.

That's exactly the trade-off the [voice guide](/programs/ai-for-leaders) of practical AI adoption keeps coming back to: AI should prepare work, and a human should approve anything high-stakes. A chat-based assistant makes that easy by default, because a person reads every output before it goes anywhere. A persistent agent with its own identity makes it easy to skip, because the whole point is that it keeps working while you're not watching. The safeguards have to be designed in deliberately, not assumed.

For Indian businesses specifically, this adds two more questions that vendors rarely volunteer: where does this agent's email, calendar and document data actually sit, and what happens to that data if you cancel the pilot? "It behaves like an employee" is a selling point in a demo. In a compliance review, it's the reason you need an answer before you say yes, not after.

## Five questions before you give an agent an identity

### 1. What can it actually access, and did anyone choose that deliberately?

A new hire gets access provisioned role by role. An agent should get the same treatment: a specific, named set of permissions tied to its job, not a copy of its creator's access because that was easier to set up. All three companies describe some form of scoped, OAuth-style permissioning. Ask your IT or security lead to confirm, in writing, exactly what the pilot agent can read, send and change.

### 2. Is there an audit trail you'd actually read?

Google's coverage mentions actions attributed to the agent's own identity in an audit log. That's only useful if someone on your team is actually assigned to review it on a schedule, the same way you'd review a new employee's first few weeks of work.

### 3. Where does a human have to approve before anything happens?

Decide this before the pilot starts, not during it. Sending an external email, committing to a number in a client conversation, or spending money should sit behind a human approval step, whatever the vendor's defaults are.

### 4. What does it cost to run, and who signs off on that?

Several reports describe usage-based billing for these persistent agents, on top of or instead of a flat seat price. That means cost scales with how much work the agent does, which is a different budgeting conversation than a per-seat software license. Finance should understand this before the pilot, not when the first invoice lands.

### 5. What's the plan if it's wrong, and how would you know?

An agent that drafts something you check before sending fails safely: you catch the mistake. An agent that acts across hours or days on a standing instruction can be wrong for longer before anyone notices. Decide how you'll sample its work, not just how you'll react if someone complains.

## Start with one narrow, low-risk pilot

Resist the instinct to hand a new "coworker" agent a broad mandate because that's how the demo was pitched. Pick one specific, recurring task where a mistake is cheap to catch and cheap to fix: drafting (not sending) a weekly status update, pulling together a recurring report from data you already trust, or triaging incoming requests into a queue a person still clears.

Run it for two to four weeks. Measure how often a human had to step in, catch an error, or override it, the same baseline-then-measure approach that works for any AI rollout. Only widen its scope, or its access, once that track record is in front of you, not before.

## The bottom line

An AI agent with its own email address is a genuine shift from an assistant you prompt to something closer to a digital employee you manage. That's not a reason to avoid piloting one. It's a reason to treat the pilot with the same rigor you'd apply to onboarding an actual new hire: scoped access, a named owner, a review cadence and a clear line for what needs human sign-off. If your leadership team is working through exactly this kind of decision, that's the core of what we cover in the [AI for Leaders](/programs/ai-for-leaders) program. For the broader "should we even be piloting agents yet" question, our earlier guide on [where AI agents work and how to start](/blog/ai-agents-for-business) is a useful companion to this one.
