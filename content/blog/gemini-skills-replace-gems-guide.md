---
title: "Gemini Skills Are Replacing Gems: How to Build One This Week"
description: "Google is retiring Gemini Gems in favor of reusable Skills. Here's what changed, how to build your first skill and what happens to your old Gems."
date: "2026-10-14"
author: "Vivek Gupta"
tags: ["AI productivity", "AI tools"]
related: "/programs/ai-generalist-certification"
relatedLabel: "AI Generalist Certification"
---

If you ever built a Gem in Gemini, a saved version of the chatbot with your own instructions baked in, for drafting client emails in your tone, or summarizing vendor contracts the way your team likes, that feature is on its way out. Google [announced on its Keyword blog](https://blog.google/products-and-platforms/products/gemini/automate-tasks-with-skills/) that **Skills** will take over from Gems as the way you customize Gemini for repeat tasks, and the rollout is already under way.

This isn't a cosmetic rename. It's worth twenty minutes this week to understand what's different and build your first one before the old system fades out from under you.

## What actually changed

Skills let you save a set of instructions once, written in plain language, and have Gemini run them again whenever a chat matches what the skill covers. Google says a skill can be invoked directly in chat, and skills can be combined with each other, something Gems couldn't do. Skills use an open format called SKILL.md, the same convention Anthropic popularized for Claude's own Skills feature.

The rollout, per Google and reporting from [Android Central](https://www.androidcentral.com/apps-software/ai/gemini-gems-are-heading-out-google-to-replace-them-with-skills-in-november), is happening in stages:

- **Gemini app (consumer):** Skills started rolling out on October 13, 2026.
- **Google Workspace:** Skills begin October 5 on Rapid Release domains and October 19 on Scheduled Release domains, completing by mid-November for most organizations.
- **Gems:** Google's own [admin help documentation](https://knowledge.workspace.google.com/p/gems-migration) says the formal transition to Skills completes in 2027, with your existing Gems migrated automatically rather than simply deleted. Different outlets report slightly different cutoff dates for when you can no longer create new Gems, so don't take any single date as final, check the in-app notice when you see one.

## Why this is more useful than a Gem

A Gem was essentially a saved system prompt: useful, but static and isolated to one chat window. A Skill is closer to a small, reusable procedure. Because skills can be combined, you can build one skill for "format a weekly sales summary" and another for "flag numbers that look off," then let Gemini apply both in the same conversation instead of juggling two separate Gems or re-explaining your formatting rules every time.

## How to build your first skill

Google's [Gemini Apps help page](https://support.google.com/gemini/answer/17094296) lists several ways to create one, and none of them require writing code:

1. **Build it in conversation.** Just tell Gemini what you want it to remember, e.g. "Every time I paste a vendor invoice, pull out the vendor name, amount and due date into a table." Gemini can turn that into a reusable skill on the spot.
2. **Start from a template.** If Google offers a template close to what you need, customize it rather than starting blank.
3. **Fill in a manual form.** Three fields: a name, a short description, and the instructions. The description matters more than it looks, it's what Gemini uses to decide when to apply the skill, so be specific about the task and the keywords that should trigger it.
4. **Upload a SKILL.md file.** If you or your team already write these for another tool, you can upload one directly, as long as it sits at the root of the project and the skill name is lowercase and hyphenated (like `vendor-invoice-summary`).

One access note: on the consumer Gemini app, skills currently require a personal Google Account and that you're 18 or older, with Keep activity turned on. On Workspace, availability depends on your organization's plan and admin settings, so if you don't see the option yet, ask your IT team whether your domain is on Rapid or Scheduled Release.

## Where this is genuinely useful at work

**Customer-facing teams** can build a skill that enforces a consistent reply structure for support tickets or sales follow-ups, so new team members don't have to be told the house style twice.

**Finance and operations** can build a skill around a recurring data-extraction task, pulling specific fields out of invoices, expense claims or vendor quotes into a consistent format, instead of re-explaining the same instructions every time.

**HR and L&D** can build a skill for a repeated writing task, job description drafts, onboarding checklists, that always follows your organization's template without someone needing to paste it in fresh each time.

## What to do with your old Gems

Don't wait for the cutoff to find out your Gem didn't migrate cleanly. This week:

1. **List the Gems you actually use.** Most people have two or three Gems that matter and several they forgot about. Only the ones you use need attention now.
2. **Rebuild your most-used Gem as a skill.** Use the same instructions, but tighten the description field, since that's what decides when the skill fires.
3. **Test it on a real task**, not a hypothetical one, before you trust it the way you trusted your old Gem.
4. **If you're on a Workspace plan**, check with your admin on which release track your domain is on, so you know roughly when Skills will appear for your team.

## The takeaway

The tool is changing, but the underlying habit isn't: the value was never the Gem itself, it was writing a clear, specific instruction once so you didn't have to repeat it. That's the same skill this blog keeps coming back to, breaking a task down clearly enough that an AI tool can run it reliably, and it's exactly what the [AI Generalist Certification](/programs/ai-generalist-certification) is built to teach, independent of which vendor renames which feature next.
