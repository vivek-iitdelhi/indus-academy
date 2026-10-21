---
title: "Anthropic's Cyber Mission: A Free AI Security Scan for Your Code"
description: "Anthropic's new Cyber Mission offers free AI vulnerability scans for open-source projects. Here's who qualifies and how to use it responsibly."
date: "2026-10-21"
author: "Vivek Gupta"
tags: ["AI tools", "AI consulting"]
related: "/consulting"
relatedLabel: "AI consulting"
---

Every Indian company I've seen, whatever it builds, runs on open-source code it didn't write and almost never reviews line by line. That's not negligence, it's how modern software works. It's also why Anthropic's new [Cyber Mission](https://www.anthropic.com/news/anthropic-cyber-mission), announced on October 8, is worth a look even if your company has no security team to speak of: part of it is a free, opt-in AI security scanner for open-source projects, and part of it is a program for defending the physical infrastructure, power, water, transport, that every business ultimately depends on.

## What Anthropic actually launched

The Cyber Mission has two parts, aimed at two different audiences.

**OSS Scanner**, for open-source maintainers, is a free, opt-in service, modeled on Google's existing OSS-Fuzz program, that runs Anthropic's most capable Claude models against enrolled open-source projects on a recurring basis. Reports include a proof of concept, a plain explanation of the issue, and a suggested fix where one exists. Anthropic is upfront that these reports are model-generated and not human-reviewed before they reach maintainers, and it expects a true-positive rate above 90%, which it's working to improve further. Maintainers whose projects don't have the capacity to triage findings at scale can instead stay on Anthropic's existing human-verified disclosure process. Enrollment runs through Anthropic's `red.anthropic.com/oss-scanner` portal.

**The Critical Infrastructure Defense Program (CIDP)** is narrower and aimed at defenders of operational technology, the systems behind power grids, water systems, transportation networks and government infrastructure. It gives trusted providers in this space frontier Claude models, on-site Anthropic engineers, and threat research. Eleven companies are founding partners, including Accenture, Deloitte, PwC, CrowdStrike, Palo Alto Networks and Rockwell Automation, several of which Anthropic says are already using Claude to find and fix vulnerabilities in the field. The program is starting with a small cohort of providers while Anthropic learns what actually works before expanding it, and it builds on an existing effort Anthropic started in June 2026 with state and local governments in the US, which has since reached more than half of US states.

Both programs sit under the same justification, Anthropic's own framing that fixing a known vulnerability is still slower and more expensive than exploiting one, and it expects that balance to favor defenders within roughly two years, but not yet.

## Why operational technology is the hard part

If you're not in critical infrastructure, CIDP doesn't apply to you directly, but it's worth understanding why Anthropic built a separate track for it. Industrial and utility systems often can't be taken offline to patch, because doing so stops power, water or transit for real people. Anthropic's own announcement notes that fixes for this kind of system can take years, and in rare cases decades, to actually land. That's a structurally different problem from patching a web server, and it's the reason this program comes with on-site engineers rather than just API access: the hard part isn't finding the vulnerability, it's getting a fix deployed into a system that's never supposed to go dark.

Indian BFSI, power and manufacturing companies running OT environments, or NBFCs with payment infrastructure that falls under similarly strict uptime rules, are the closest domestic equivalent. None of the eleven founding partners are Indian firms as of this announcement, so there's no direct access route yet, but it's a program worth tracking if your company works with international OT security vendors, since partnership details tend to expand over time.

## Who should actually use OSS Scanner this week

This is the part nearly every company can act on immediately, whether or not you have a dedicated security function.

### 1. Find out if your company maintains any open-source projects

Check with your engineering leads: many Indian companies, especially in IT services and product engineering, maintain internal tools, SDKs or libraries they've open-sourced, sometimes without central visibility. Any of these are candidates for enrollment.

### 2. Enroll, but don't skip human review of what comes back

Because Anthropic is explicit that these reports aren't human-verified before they reach you, treat each one as a lead, not a verdict. Someone on your team should confirm a finding is real and check the suggested fix before merging it, the same way you'd treat a report from any automated scanner, AI-generated or not.

### 3. Don't assume this replaces your existing dependency scanning

OSS Scanner checks the open-source projects you maintain. It doesn't replace scanning the open-source packages you merely depend on, which is a different (and for most companies, larger) risk surface. Keep whatever dependency-scanning tool you already use; this is additive, not a substitute.

### 4. Loop in whoever owns your security budget, even informally

If your company has no dedicated security hire, this is usually whoever owns IT or engineering. A free scan is low-risk to enable, but someone should still own triaging what it finds, rather than letting reports sit in an inbox nobody checks.

## What this signals about the next year

Anthropic funding a free scanner for open-source code, alongside direct funding for the Python Software Foundation, the Apache Software Foundation and OpenSSF through its Defender Advantage Fund, is a bet that the cheapest way to improve security at scale is automating the unglamorous, high-volume work: scanning, triaging and drafting fixes, rather than relying on scarce human reviewers to get to everything. That's consistent with a view worth adopting in your own company regardless of Anthropic's specific tools: AI is better matched to high-volume, well-defined checking work than to judgment calls about what to do with what it finds. Build your own security and compliance habits around that split, let AI widen the net, keep a person deciding what's actually worth fixing first.

## The bottom line

If your company maintains any open-source code, enrolling it in OSS Scanner costs nothing and adds a layer of automated checking most teams don't currently have, as long as someone owns reviewing what it reports. If you're in BFSI, power, manufacturing or another sector running operational technology, CIDP is a program to watch rather than apply to yet, since none of its current partners operate in India. Either way, this is a reminder that AI security tooling is moving from "something only large security teams have" toward something any engineering team can use directly, which is exactly the kind of shift worth building into your company's AI governance now rather than reacting to later. That's the kind of groundwork our [AI consulting](/consulting) work helps Indian businesses put in place.
