---
title: "How to Check an AI Vendor's Safety Claims: A Practical Test"
description: "Anthropic let outside investigators into its own offices to verify its safety claims. Here's the four-point test to run on any AI vendor."
date: "2026-10-27"
author: "Vivek Gupta"
tags: ["AI consulting", "Corporate AI training"]
related: "/consulting"
relatedLabel: "AI consulting"
---

Ask any AI vendor whether their model is "safe" and you'll get the same answer: yes, we take this seriously, here's our trust page. Almost no one asks the follow-up question that actually matters: who checked that claim, and could they have said no publicly if it wasn't true? Most Indian companies I talk to have never asked it, because there's rarely been a concrete answer to compare against. Anthropic just gave one. On October 15, it [described how it works with independent evaluators](https://www.anthropic.com/news/an-update-on-independent-evaluators), including giving a team from the nonprofit METR employee-like access inside the company, and it's worth using as a template for how you question every AI vendor you rely on.

## What Anthropic actually did

Anthropic onboarded six employees from METR, a nonprofit that evaluates frontier AI models, with company hardware, office access and internal tools roughly comparable to what Anthropic's own risk teams use. METR will publish its own analysis of Anthropic's risk levels, incidents and practices, and has already reviewed several of Anthropic's internal Risk Reports over the past year. A second group, SecureBio, is separately reviewing the chemical and biological weapons chapter of Anthropic's August 2026 Risk Report. Anthropic is also working with Accenture and Faculty on model evaluation and red-teaming, and has early conversations underway with others, including Hugging Face.

This follows Anthropic's commitment to stronger third-party assessment and the White House Accord on Super Intelligence, where AI companies agreed to work with independent external auditors. The stated reason is specific: some safety information can't be made fully public because it could help bad actors or exposes commercially sensitive details, so instead of just publishing a summary, Anthropic lets outside evaluators go deep and report what they find.

## The four-point test worth borrowing

Anthropic lists four things it says a real independent evaluator needs. These four questions are the actual test, and they work on any AI vendor's safety or security claims, not just Anthropic's:

1. **Expertise.** Does the evaluator actually understand how frontier AI evaluations can fail, not just how to run a checklist?
2. **Independence.** Do they hold equity in the company, or depend on it financially or operationally? If yes, their sign-off is worth less.
3. **Access.** Do they see enough of the model, its training and its safeguards to say something meaningful, or just a sanitized demo?
4. **Freedom to publish.** Can they say what they found without the vendor's approval, or does the vendor get a veto?

Most vendor "trust pages" fail at least two of these quietly. A logo wall of certifications tells you a company passed a standard audit. It doesn't tell you whether the auditor had real access or could have published something embarrassing.

## Why the access tiers matter more than the headline

Anthropic structures this as three tiers rather than one all-or-nothing arrangement, and the tiering is the more useful idea to copy:

- **Tier 1:** Narrow, specific investigations. The vendor picks what the evaluator sees, and publication needs the vendor's approval.
- **Tier 2:** Broader access, and the evaluator can publish without approval, though the vendor can still require redaction of specific categories like confidential IP.
- **Tier 3:** METR's arrangement — employee-like access, publication rights similar to Tier 2, and Anthropic cannot veto what gets published, only require redaction in predefined categories.

A vendor that only ever offers Tier 1-style access, dressed up as a full audit, is not giving you the same thing as a vendor that lets evaluators publish freely. When you're told "we've been independently audited," ask which tier you're actually looking at.

## Turn this into questions for your own AI vendor

You don't need an in-house security team to use this. Next time you're renewing or signing an AI vendor contract, whether it's for a chatbot, an agent platform or a model API, ask:

- **Who evaluates your safety and security claims, and are they financially independent of you?** A consulting firm you pay to produce a favorable report isn't independent in the sense that matters.
- **Can they publish findings without your approval?** If every audit result goes through your PR team first, it's marketing, not verification.
- **What exactly did they have access to?** A one-day interview with your product team is a different thing from sustained access to how the system actually works.
- **Does this cover the risk I actually care about?** Anthropic's current evaluator work is focused on catastrophic risks like bioweapons and cyberattacks. That tells you almost nothing about whether the model will leak your customer data or hallucinate in a client-facing chat. Ask the narrower, boring question directly: who checks that, and how.

This last point is the one most Indian companies skip. We've written before about [what to ask any AI vendor about data residency](/blog/ai-vendor-data-residency-checklist), and the same discipline applies here: a vendor's general safety reputation tells you very little about whether your specific use case, your specific data, is handled the way you were told.

## Be honest about what this doesn't solve

Anthropic is upfront that this is voluntary, not a regulatory requirement, and still developing. It doesn't mean every AI vendor has anything like this in place, and it doesn't mean Anthropic's own customer data is any more exposed to these evaluators than before — the arrangement is explicitly structured so METR and SecureBio get model-level access, not your company's data or Anthropic's customer information. Treat an answer like "we're SOC 2 certified" or "we follow responsible AI principles" as a starting point for more questions, not as the answer itself. The test isn't whether a vendor has a safety page. It's whether anyone outside the company could have found a real problem and said so publicly.

## Where to start this week

Pick the one AI tool in your company with access to the most sensitive data, customer support, HR, finance, whatever it is, and ask the vendor the four questions above in writing. You'll either get a straight answer, which tells you something useful, or a vague one, which tells you something too. If you're building out a broader AI vendor review process for your team, that's exactly the kind of practical groundwork our [AI consulting](/consulting) work with Indian businesses focuses on: asking the right questions before you scale, not after something goes wrong.
