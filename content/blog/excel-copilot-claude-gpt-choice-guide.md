---
title: "Copilot in Excel Can Now Use Claude or GPT: How to Choose"
description: "Copilot in Excel added a model switcher for Claude and GPT. Here's how Indian finance and ops teams should decide which model to use, and when."
date: "2026-10-31"
author: "Vivek Gupta"
tags: ["AI tools", "AI productivity"]
related: "/programs/ai-generalist-certification"
relatedLabel: "AI Generalist Certification"
---

Most people using Copilot in Excel never think about which AI model is actually doing the work behind the "Copilot" button. That changed recently: Microsoft now lets you pick the model yourself, choosing between Anthropic's Claude and OpenAI's GPT models for the same task, right inside the same spreadsheet ([Microsoft support](https://support.microsoft.com/en-us/excel/choose-your-model-when-editing-with-copilot-in-excel)). If your team runs budgets, reconciliations or reporting through Copilot in Excel, this is worth twenty minutes of attention before you keep clicking "Auto" out of habit.

## What actually changed

Copilot in Excel now has a model switcher. Open the switcher and you can select a specific Claude model, a specific GPT model, or leave it on Auto, which lets Copilot pick the model it judges best for your request ([Microsoft support](https://support.microsoft.com/en-us/excel/choose-your-model-when-editing-with-copilot-in-excel)). This sits inside Agent Mode in Excel, Microsoft's feature for multi-step spreadsheet work, where Copilot plans and executes a sequence of edits rather than answering one prompt at a time. Agent Mode itself is now generally available across Excel for web, Windows and Mac, for commercial Microsoft 365 Copilot licenses as well as Microsoft 365 Personal, Family and Premium subscribers, though it is not yet available to customers in the EU or UK ([Microsoft Tech Community](https://techcommunity.microsoft.com/blog/excelblog/agent-mode-in-excel-is-now-generally-available-on-desktop/4457408)).

Two things worth knowing before you touch the switch:

1. **The choice only lasts the session.** When you close Excel or end the session, Copilot reverts to the default model for your tenant ([Microsoft support](https://support.microsoft.com/en-us/excel/choose-your-model-when-editing-with-copilot-in-excel)).
2. **Claude isn't on by default for everyone.** For enterprise customers, your admin has to turn on Anthropic as a Microsoft sub-processor in the Microsoft 365 Admin Center before anyone in the tenant can select Claude in Agent Mode. Microsoft's own documentation is explicit that Claude models are hosted outside Microsoft's infrastructure and are subject to Anthropic's separate terms and data handling ([Microsoft support](https://support.microsoft.com/en-us/topic/use-claude-with-agent-mode-in-excel-b2c3b3ec-154b-484b-84d0-914a80df395a)).

This rollout is part of a broader move: Microsoft's message center notice to admins confirmed newer models, including GPT-6.1 Sol and Claude Sonnet 5.5, rolling out across Copilot in Word, Excel, PowerPoint, Copilot Chat, Copilot Studio and Cowork, not just Excel alone ([Microsoft 365 message center, mirrored by M365 Admin](https://m365admin.handsontek.net/microsoft-copilot-gpt-6-1-sol-claude-sonnet-5-5-beginning-roll-today/)).

## Why a model switch matters for a spreadsheet

Six months ago, "which AI model" was a question for engineers choosing an API. Now it's a question for whoever builds the monthly MIS deck. That's a real shift in what counts as an AI skill for a finance or operations professional: not writing code, but knowing enough about how models differ to pick the right one for the task in front of you, and checking its work either way.

Models differ in how they reason through long, multi-step work versus how quickly and cheaply they answer a narrow question. A spreadsheet task that chains ten formulas, reshapes a pivot table and then writes a summary is a different kind of workload than "give me the SUMIFS formula for this range." Microsoft gives you the switch precisely because no single model wins at everything, and letting Copilot guess on Auto is a reasonable default, not the only option.

## A simple way to decide, without guessing

Don't try to memorize which model is "better." Test it on your own data instead, the way you'd trial any new tool before rolling it out.

1. **Pick one recurring Excel task** your team already does every week: a reconciliation, a variance report, a pricing sheet. Something with a known, checkable right answer.
2. **Run it once on Auto**, once with a specific GPT model, and once with a specific Claude model, if your admin has enabled it. Keep the same prompt for all three.
3. **Check the output against the real numbers**, not just whether it "looks right." Formula errors in a spreadsheet are easy to miss visually and expensive to miss in practice.
4. **Time it.** If one model is noticeably slower for the same accuracy, that matters for a task you'll run every week.
5. **Pick a default for that specific task**, and leave Auto on for everything else until you've tested it too.

This is the same narrow-pilot discipline worth applying to any AI rollout: test on one real, frequent workflow before deciding anything for the whole team.

## The data residency question Indian teams shouldn't skip

If you work in BFSI, insurance or any sector with data residency or vendor-risk obligations, the sub-processor detail above is the part to read twice, not skip. Switching to Claude in Excel doesn't just change which AI answers your prompt — it changes which company's infrastructure processes your spreadsheet data, under whose terms. Before your team enables Anthropic as a sub-processor tenant-wide, your compliance or IT security function should know this is happening and sign off on it, the same way they would for any new vendor touching company data. This is worth asking about for every AI feature, not just this one: [where does the data actually go, and under whose terms](/blog/ai-vendor-data-residency-checklist).

## Don't let "better model" become an excuse to skip the review

A faster or more capable model doesn't change the basic rule for anything AI touches in a spreadsheet that feeds a decision: a person checks it before it goes out. Claude or GPT, Auto or manual, the point of the switch is giving your team a way to get more accurate output on tasks that matter, not a reason to trust the output more blindly. If you're evaluating this alongside other recent AI model upgrades your vendors have pushed out, the same checklist applies: [what changed, what you tested, and what you're still verifying by hand](/blog/claude-opus-5-5-evaluate-ai-model-upgrades).

Model choice is a small feature with a bigger lesson underneath: tools change every few months, and your job isn't to chase each one but to build the habit of testing before you trust. That habit, more than any specific model, is the skill worth building deliberately across your team.
