---
title: "Voice AI at Scale: What Mahindra Finance's Rollout Teaches You"
seoTitle: "Voice AI at Scale: Lessons from Mahindra Finance's Rollout"
description: "Mahindra Finance's voice AI now spans 12 Indian languages and 1 crore+ calls. What that scale-up teaches other Indian businesses about voice AI."
date: "2026-09-16"
author: "Vivek Gupta"
tags: ["Voice AI", "AI automation"]
related: "/consulting"
relatedLabel: "AI consulting"
---

At Global Fintech Fest 2026 in Mumbai, Mahindra & Mahindra Financial Services said its voice AI deployment, built on the Bengaluru company Sarvam's platform, has now crossed one crore calls across 12 Indian languages, spanning sales, collections and employee feedback, according to [CIO&Leader's coverage of the announcement](https://www.cioandleader.com/mahindra-finance-and-sarvam-expand-voice-ai-collaboration-across-sales-collections-and-employee-engagement/). That's one of the largest voice AI deployments in Indian financial services to date, and it's a useful case to study even if you're nowhere near that scale, because the way it was built tells you what to prioritize before you launch your own.

## What was actually announced

The partnership isn't new — Mahindra Finance and Sarvam had already been working together — but the September 11 announcement described an expansion: Mahindra's in-house AI division layered voice agents on top of its existing machine learning models, so predictions the models already made (who to call, what to offer, who's at risk of default) get turned into real conversations in the customer's own language, at call-center scale. The reported use cases are sales outreach, collections follow-ups and internal employee feedback calls, run across 12 Indian languages.

Two things stand out. First, voice AI wasn't used to replace the prediction models; it was used to act on their output faster and more consistently than a human calling team could. Second, employee-facing use cases (feedback, internal engagement) came alongside customer-facing ones, which suggests the appetite for AI-driven calling in India isn't limited to sales and support.

## Why Indian-language voice AI is a different problem

If you've tried a voice bot built on a generic English speech stack and had it fall apart the moment a caller mixed Hindi and English in the same sentence, you've seen why this matters. Sarvam's own [documentation for its voice agent platform](https://www.sarvam.ai/text-to-speech/voice-agents) describes handling code-switching — the normal Indian habit of mixing languages mid-sentence — at the model level rather than by detecting a language boundary and routing to a separate engine. That distinction matters in practice: a caller in Bengaluru saying "mera EMI kab tak due hai" doesn't hit a pause or a voice change partway through the sentence, because the model was trained on real Indian speech patterns, not translated scripts.

The platform also reports streaming latency under 250 milliseconds and speech recognition across 11 Indian languages with Hinglish support built in, rather than as a bolt-on. For any Indian business, the lesson isn't "use Sarvam specifically" — it's that language coverage and code-switching are the real product differentiator for voice AI here, not raw model intelligence. A voice agent that reasons brilliantly but pauses awkwardly every time a caller switches from English to Marathi will lose trust in the first ten seconds.

## A playbook for scaling voice AI in your business

Mahindra Finance didn't start at one crore calls. Whatever the internal rollout looked like, the shape of a sensible scale-up applies broadly:

1. **Start with one high-volume, well-defined call type.** Collections follow-ups and routine sales outreach are good starting points because the script is predictable and the cost of a bad call is a redo, not a lost relationship.
2. **Feed the voice layer from a model or rule you already trust.** If you already know who to call and why, voice AI's job is to have the conversation well, not to decide who gets called. Don't ask a voice agent to do both jobs on day one.
3. **Measure calls completed, resolution rate and escalations, not just minutes saved.** A call that sounds fluent but doesn't resolve the customer's issue isn't a win.
4. **Cover your real language mix before you scale volume.** If a meaningful share of your customers call in Tamil, Bengali or Hinglish, test the agent on that mix specifically before rolling out company-wide — don't assume an English or Hindi-only pilot will generalize.
5. **Bring employee-facing use cases in as a second wave**, once the customer-facing agent has proven itself. Internal feedback and HR calls are lower risk and a good way to build organizational trust in the technology.

## Where voice AI still needs care

Voice AI handling money — EMI reminders, collections, account queries — sits inside real regulatory constraints in India. The RBI's FREE-AI committee report set out seven guiding principles for AI in financial services, including safety, transparency and accountability, and explicitly named voice-enabled banking as a way to widen financial access, according to the [RBI's own FREE-AI report](https://rbidocs.rbi.org.in/rdocs/PublicationReport/Pdfs/FREEAIR130820250A24FF2D4578453F824C72ED9F5D5851.PDF). If you're building or buying voice AI for lending, collections or account servicing, know where call recordings and transcripts are stored, who can access them, and how that fits the Digital Personal Data Protection Act before you scale past a pilot. This isn't a reason to avoid voice AI — it's a reason to design the data flow deliberately from the start, the same way Mahindra Finance's team would have had to for a regulated lender.

It's also worth saying plainly: a fluent voice agent in 12 languages is a serious engineering effort, not a weekend integration. Getting there took an existing prediction layer, a voice platform built specifically for Indian speech, and enough call volume to iterate. If your business handles a fraction of that volume, the right first step is a narrow pilot on one language and one call type, not a 12-language launch on day one.

## The takeaway

The specific numbers — one crore calls, 12 languages — matter less than the sequence: predict first, then call, measure resolution not just fluency, and cover your real language mix before you scale. That sequence is the same whether you're a large NBFC or a regional retailer with a few thousand customers a month calling in Hindi and English. Our sister company [IndusLabs](https://induslabs.io) builds voice AI and workflow automation for exactly this problem — Indian languages, accents and the code-switching that generic voice stacks miss. If you're weighing where voice AI fits in your own operations, our [AI consulting](/consulting) work starts with the same first question this playbook does: which one call type should you automate first.
