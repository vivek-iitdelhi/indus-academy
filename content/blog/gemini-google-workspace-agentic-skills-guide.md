---
title: "Gemini Can Now Work Across Your Google Apps: A Practical Guide"
seoTitle: "Gemini's New Agentic Skills in Google Workspace"
description: "Google added 5 agentic Gemini features that work across Gmail, Docs, Sheets and Slides. Here's how to use them without losing control of your work."
date: "2026-09-20"
author: "Vivek Gupta"
tags: ["AI productivity", "AI tools"]
related: "/programs/ai-generalist-certification"
relatedLabel: "AI Generalist Certification"
---

Most of us use Gemini one app at a time: ask it something in Gmail, then switch to Docs, then to Slides, stitching the output together ourselves. Google just changed that. On September 9, 2026, [Google Workspace announced five agentic capabilities](https://workspace.google.com/blog/product-announcements/less-switching-more-flow-5-new-agentic-capabilities-across-google-workspace-apps) that let Gemini move across Gmail, Drive, Docs, Sheets, Slides and Chat to finish a task, not just answer a question inside one app.

If you spend your week building reports from scattered emails and files, this is worth twenty minutes of your time this week to set up.

## What actually changed

The five capabilities, per Google's announcement, are:

1. **Cross-app task execution.** You can prompt Gemini from wherever you're working — say, in Gmail — and it completes a task that spans Drive, Docs, Slides and Chat, rather than staying confined to the app you typed the prompt in.
2. **Background content creation.** Gemini generates a formatted Doc, a structured Sheet or a stylized Slide deck in the background and saves it to your Drive, so you don't watch it work.
3. **Document-to-deck conversion.** A written document can be turned directly into a fully editable slide deck without you rebuilding the structure by hand.
4. **Auto-generated project presentations.** Gemini pulls from your active projects, Chat threads, Gmail inbox and open action items to build a multi-slide presentation on its own.
5. **Task and calendar coordination.** Gemini can create task reminders, spot open calendar slots, flag scheduling conflicts and help set up meetings.

Google also [added Model Context Protocol (MCP) connectors](https://workspaceupdates.googleblog.com/2026/09/connect-to-more-tools-with-gemini-in-Google-Workspace.html) so Gemini can reach outside Workspace into tools like Asana, Atlassian Rovo, HubSpot, Mailchimp, QuickBooks, Monday and Salesforce. That's the more interesting shift for working professionals: Gemini stops being a Workspace-only assistant and starts touching the tools where your actual work lives.

## Where this helps most

**Weekly and monthly reporting.** If you currently pull numbers from a Sheet, write commentary in a Doc and then rebuild it all as a deck for a review meeting, the document-to-deck conversion and background content creation features can cut that rebuild step out entirely. Draft the Doc as you normally would, then ask Gemini to turn it into slides.

**Status updates from scattered threads.** Anyone who spends Monday mornings reconstructing "what happened last week" from Gmail and Chat can let Gemini's project-presentation feature do the first pass. It won't get everything right, but a rough first draft from your real inbox beats a blank slide.

**Meeting prep across tools.** If your calendar coordination is genuinely painful — finding a slot across five people's calendars, then following up by email — the task and calendar coordination feature is a small but real time saver.

## Where it will still let you down

Be clear-eyed about the limits before you build a habit around this. Cross-app agents are only as good as the context they can see, and three failure modes show up quickly in practice:

- **Stale or duplicate threads.** If your Gmail has three overlapping email chains on the same project, the auto-generated presentation may quote the outdated one, or blend contradicting numbers from two threads without flagging the conflict.
- **Formatting drift.** A document-to-deck conversion gets the structure right more often than the tone. Technical documents with tables or nested lists tend to convert more cleanly than narrative ones; expect to rework slide density and headlines by hand.
- **Silent scope creep.** Because the agent reaches across Drive, Gmail and Chat on its own, it's easy to lose track of exactly which files fed a given output. Before sharing anything externally, ask yourself what sources it drew from, not just whether the output looks right.

None of this makes the features not worth using. It just means the review step in the checklist below isn't optional.

## An example worth stealing

Picture an operations manager at a mid-size distribution business who currently spends Friday afternoon pulling numbers from a shared Sheet, checking Slack-style Chat threads for exceptions, and building a Monday leadership deck by hand. With cross-app execution, that Friday task becomes: ask Gemini to draft the deck from the week's Sheet updates and open Chat threads, then spend the freed-up hour actually checking the numbers and rewriting the two or three slides that need a human's judgment. The time saved isn't in the drafting — it was never the hard part — it's in not starting from a blank slide every week.

## How to start using it this week

1. **Turn on the connectors you actually use.** Go to Gemini's settings in Workspace and connect only the tools you touch daily — HubSpot if you're in sales, QuickBooks if you're in finance, Asana or Monday if you run projects. Don't connect everything; each connection is something you'll need to audit later.
2. **Start with one recurring task, not everything at once.** Pick the report or deck you rebuild most often and try the new cross-app flow on it for two weeks before rolling it out to your team.
3. **Always review before you send.** These are still generative outputs pulled from your real inbox and files. Read the draft Doc, Sheet or deck fully before it goes to a client or your manager — Gemini can misread context in a Chat thread or an old email the same way any assistant can.
4. **Check your organization's data settings.** If you're on a Workspace Business or Enterprise plan, ask your IT or admin team whether Gemini's cross-app access and third-party connectors have been reviewed under your company's data policy, especially if you handle client or financial data. Indian companies working with regulated data (BFSI, healthcare) should confirm this before turning on connectors like QuickBooks or Salesforce.
5. **Watch what it pulls into presentations.** The auto-generated project presentation feature reads across Gmail, Chat and Drive. Before you present it externally, check that it hasn't surfaced something meant to stay internal.

## The bigger pattern

This is part of a trend we've flagged before on this blog: AI assistants are moving from single-app helpers to agents that act across your whole toolchain (see our piece on [what AI agents mean for business](/blog/ai-agents-for-business)). The skill that matters isn't learning Gemini's menu — it's learning to break a recurring task into steps an agent can follow, and to check its output before it goes out the door. That's the same skill whether the tool is Gemini, Copilot or something else entirely.

Start small: pick the one weekly task that eats the most of your Monday, try the new cross-app flow on it, and only expand once you trust what comes out. If your team wants a structured way to build this kind of AI fluency instead of learning tool-by-tool, our [AI Generalist Certification](/programs/ai-generalist-certification) is built around exactly this: applying AI across real workflows, not just one app at a time.
