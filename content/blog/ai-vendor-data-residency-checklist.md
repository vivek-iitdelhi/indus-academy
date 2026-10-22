---
title: "AI Data Residency: What to Ask Any Vendor Before You Scale"
description: "Anthropic's new Singapore office shows what in-region AI processing looks like. A practical checklist for evaluating any AI vendor's data handling."
date: "2026-10-22"
author: "Vivek Gupta"
tags: ["AI consulting", "Corporate AI training"]
related: "/consulting"
relatedLabel: "AI consulting"
---

Most companies evaluating an AI vendor ask about pricing, accuracy and integrations. Almost none of the Indian leaders I talk to can answer a simpler question on the spot: when your team sends a customer record to that AI tool, which country does it actually get processed in? Anthropic's announcement this week of a new regional setup gives a clean, concrete example of what the right answer looks like, and it's worth using as a template for every AI vendor your company already uses.

## What Anthropic announced

On October 14, Anthropic [opened its fifth Asia-Pacific office](https://www.anthropic.com/news/singapore-office-opening), in Singapore, and signed a memorandum of understanding with Singapore's Ministry of Digital Development and Information, covering AI safety and security research, studying how AI adoption actually plays out, and responsible AI adoption across the public and private sectors. The MOU was signed on the sidelines of Singapore International Cyber Week by the ministry's Permanent Secretary, Kai Fong Chng, and Anthropic co-founder Ben Mann.

The detail that matters for any business evaluating AI vendors, not just companies operating in Singapore, is this line from the announcement: regulated firms can run Claude with **in-region inference on Amazon Bedrock** to meet their data processing requirements. In plain terms, a bank or insurer in Singapore can now specify that its data stays and gets processed within Singapore, rather than wherever the vendor's nearest data centre happens to be.

Anthropic also said it will work on helping small and medium businesses in the region adopt AI responsibly and will look at ways to strengthen local AI skills, alongside already-public deployments with GovTech Singapore (over 1,500 engineers using Claude Code), DBS, GIC, Grab, Sea and Supabase. None of this is specific to India. It's useful here precisely because it's a clear, documented example of a major AI vendor offering a specific, named answer to the "where does our data go" question, something most companies accept a vague answer to.

## Why this matters even if you never touch Bedrock

Indian businesses already weigh data location when choosing software, particularly in BFSI, healthcare and any business handling customer financial data, where sector regulators and India's own data protection framework make this more than a preference. The problem isn't that Indian leaders don't know data location matters. It's that most AI vendor evaluations never get past "is this tool good," straight to a signed contract, without anyone asking the more boring question of where the processing actually happens and what options exist to change that.

This is a gap we've flagged before in India's broader AI governance picture: only 22% of Indian enterprises currently have governance processes, including knowing where vendor data goes, in place at all (see our [AI governance checklist](/blog/ai-governance-gap-india-checklist)). Data residency is one of the most concrete, answerable items on that list, and one of the easiest to check before a tool is already embedded in daily work, not after.

## A five-question checklist for your next AI vendor conversation

You don't need a legal team in the room to ask these. You need five minutes with whoever's selling you the tool, and the willingness to walk away from a vague answer.

1. **Where is data processed, specifically?** Not "the cloud" or "we're secure," a named region or country. If the vendor can't answer this precisely, that's itself useful information.
2. **Is in-region processing available, and at what cost?** As the Anthropic example shows, some vendors can offer this as a configuration, not a custom enterprise deal. Ask directly whether it exists for your plan, and what it costs to turn on.
3. **What happens to data used for training or improvement?** Separate from where data is processed, ask whether your inputs are used to train the vendor's models by default, and how to opt out if they are.
4. **Who else touches the data?** Many AI tools run on top of another company's infrastructure, the way Anthropic's Bedrock option runs on AWS. Ask for the full chain, not just the vendor's own name.
5. **What's the retention period, and can you shorten it?** Ask how long inputs and outputs are stored, and whether that's configurable. A vendor with a clear, short default retention period has usually thought about this more than one that doesn't mention retention until you ask.

Write the answers down, even in a simple spreadsheet, next to each AI tool your company uses. The gaps you find aren't necessarily reasons to stop using a tool. They're reasons to know what you're exposed to, and to negotiate for better terms while you still have leverage, before the tool is load-bearing for a business process.

## Treat this as a procurement habit, not a one-time audit

The mistake most companies make is treating data residency as something to check once, during a security review, and then forget. Vendors change infrastructure, add regions and change default settings more often than companies revisit old contracts. Build the five questions above into how you evaluate every new AI tool going forward, not just the big enterprise ones. A WhatsApp chatbot vendor handling customer queries deserves the same five questions as a vendor handling your financial data, because customer conversations are personal data too.

If you're rolling this out across a team, pair it with a simple rule: no new AI tool goes into production, even a small one, without someone writing down the answer to question one. That single habit catches most of the risk, long before it requires a formal governance committee.

## The actual lesson from Singapore

Anthropic's move isn't news because of Singapore specifically. It's useful because it shows, in public, exactly what a serious answer to "where does our data go" looks like from a major AI vendor: a named region, a named infrastructure partner, and a documented option for regulated customers. That's the standard to hold every vendor your company works with to, whether they're based in the US, Singapore or Bengaluru. If you want a structured way to build this kind of vendor evaluation into how your company adopts AI more broadly, that's exactly the groundwork our [AI consulting](/consulting) work helps Indian businesses put in place.
