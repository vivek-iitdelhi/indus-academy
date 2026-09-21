# Program delivery handbook

Internal. How every Indus AI Academy program is prepared, run and assessed. The public curricula live in `src/content/programs.ts` and `src/content/tracks.ts`; this file covers everything that is not on the website.

## Delivery standards

Applies to every program unless stated otherwise.

| | Standard |
| --- | --- |
| Cohort size | 25 maximum for hands-on programs; 40 for the AI Foundations Workshop |
| Session length | 2 hours (3 for the bootcamp), never more than 3 without a break |
| Structure | 15 min recap and framing · 20 min demonstration · 60 min build lab · 15 min review and Q&A · 10 min homework brief |
| Platform | Live video with recording, a shared workspace for materials, and a chat channel that stays open between sessions |
| Recordings | Shared within 24 hours, available to the cohort for 6 months |
| Doubt clearing | One 45-minute open hour each week, separate from sessions |
| Attendance | Tracked per session; 75% required for certification |
| Faculty | One lead instructor, plus one lab assistant for cohorts over 15 |

## Before any program starts

1. **Confirm the scope.** Program, dates, participant list, and for corporate cohorts, the team's tools and data policies.
2. **Send the welcome pack**, a week ahead: schedule, what to install, accounts to create, and the pre-work.
3. **Check accounts.** Every participant needs a working AI assistant account, and for build sessions, an automation tool account. Chase the stragglers 48 hours before, not on the day.
4. **Run the baseline.** A 10-minute self-assessment of current AI use. Repeat it at the end; the difference is what leadership wants to see.
5. **Collect real material.** Ask participants for a document, spreadsheet or ticket they work with, sanitised. Exercises use these rather than invented data.
6. **Prepare a fallback.** Every demonstration needs a saved transcript or screenshot in case a live model call fails or the network drops.

## Session mechanics that make the difference

- **Build in the room.** If people leave without having made something, the session failed, regardless of how good the slides were.
- **Use their data.** A finance team automating their own invoice format learns more than any generic demo.
- **Show the failures.** Deliberately let a model hallucinate and let the room catch it. Trust comes from seeing the limits, not hearing about them.
- **Keep pace for the slowest third.** Give the fast half an extension task rather than racing ahead.
- **End with a commitment.** Each person names one thing they will use before the next session. Open the next session by asking what happened.

## Program notes

### AI Generalist Certification — 12 sessions, 24 hours

- **Watch for:** a wide skill spread. Sessions 1–3 feel slow to advanced learners; give them the extension tasks. Sessions 7–8 (automation) are where beginners stall; the lab assistant should focus there.
- **Heavy sessions:** 7, 8 (automation setup) and 11 (deployment). Allow extra lab time and have a working template ready to share.
- **Capstone:** proposed in session 8, checked in session 10, presented in session 12. Reject capstones that are not from the participant's real work.
- **Materials:** prompt library template, automation starter templates, capstone brief and rubric, a model comparison sheet.

### AI for Leaders — 6 sessions, 12 hours

- **Watch for:** the room wanting vendor recommendations. Stay on frameworks and decision criteria; name categories, not favourites.
- **Every session produces an artefact.** If a session ends without one, it was a lecture, and the program loses its value.
- **In-house version:** replace the generic examples with their industry before the first session. Ask for their last board deck on technology, if they will share it.
- **Materials:** opportunity scoring sheet, vendor scorecard, AI policy template, roadmap template.

### AI Automation & Agents Bootcamp — 12 sessions, 36 hours

- **Watch for:** participants with very different stacks. Agree the reference stack in week one; support others in the open hour, not in class.
- **Graded builds:** after sessions 3 (retrieval), 6 (evaluations) and 9 (integrations). Return feedback within 72 hours.
- **Costs:** participants pay for their own API usage. Warn them in the welcome pack and cover budgets and caps in session 10.
- **Materials:** starter repository, evaluation harness template, guardrail examples, deployment checklist, capstone rubric.

### AI Foundations Workshop — 1 day, 6 hours

- **Watch for:** the room going quiet after lunch. Session 3 must be the most hands-on of the day.
- **Set-up time:** 30 minutes before the start for accounts and logins. Do not eat into session 1 for this.
- **Leave-behind:** each participant's own prompt library and the one-page safe-use checklist, emailed the same evening.

### Corporate role tracks — 4 sessions, 8 hours each

- **Discovery call first** (60 minutes, with the team's manager): tools in use, data rules, the three workflows that hurt most, and how success will be judged.
- **Tailoring:** swap every exercise for the client's own workflow. Budget four hours of preparation per track.
- **On site:** confirm room layout, screen, power, guest Wi-Fi and whether their network blocks the tools. Blocked tools are the most common cause of a bad on-site day.
- **Report:** send the sponsor a one-page summary within a week: attendance, what each person built, adoption recommendations.

## Capstone rubric

Score each from 1 to 5. A pass needs 3 or more on every line and 16 or more overall.

| Criterion | What a 5 looks like |
| --- | --- |
| Real problem | Solves a task the participant actually does, with a before-and-after time or quality measure |
| Working solution | Runs end to end without the participant intervening at every step |
| Judgement | Right tool for the job; human review where it matters |
| Reliability | Handles a bad input without producing nonsense or failing silently |
| Explanation | Can explain how it works, its limits and what they would do next |

Bootcamp capstones are additionally scored on evaluation coverage, guardrails, observability and cost control.

## Certification

1. Confirm attendance (75%) and capstone pass.
2. Issue the certificate in the name of INDUS AI Private Limited, with the participant's name, program, hours and date.
3. Keep a register of issued certificates: name, email, program, cohort, date, capstone title.
4. For corporate cohorts, send the sponsor the list of certified participants with the summary report.

## Cohort dates

| Program | Cohort | Starts | Ends | Schedule | Seats |
| --- | --- | --- | --- | --- | --- |
| AI Generalist Certification | Cohort 01 | Thu 15 Oct 2026 | Tue 10 Nov 2026 | Tue, Thu, Sat · 7–9 PM IST | 25 |
| AI for Leaders | Cohort 01 | Sat 17 Oct 2026 | Sat 21 Nov 2026 | Saturdays · 10 AM–12 PM IST | 20 |
| AI Automation & Agents Bootcamp | Cohort 01 | Mon 2 Nov 2026 | Wed 16 Dec 2026 | Mon, Wed · 7–10 PM IST | 20 |
| AI Foundations Workshop | October workshop | Sat 24 Oct 2026 | Sat 24 Oct 2026 | One Saturday · 10 AM–5 PM IST | 40 |

Cohort dates live in `src/content/programs.ts`. Change them there and the website, the Course schema and the payment flow all follow.

## Early bird

The early-bird price applies while **both** conditions hold, and the site shows the deadline:

| Program | Early bird | Full price | Seats at early bird | Booked by |
| --- | --- | --- | --- | --- |
| AI Generalist Certification | ₹19,999 | ₹24,999 | First 15 | 5 Oct 2026 |
| AI for Leaders | ₹31,999 | ₹39,999 | First 10 | 10 Oct 2026 |
| AI Automation & Agents Bootcamp | ₹35,999 | ₹44,999 | First 10 | 20 Oct 2026 |
| AI Foundations Workshop | ₹3,999 | ₹4,999 | First 20 | 15 Oct 2026 |

- **The date is enforced automatically.** After the deadline the site charges the full price, with no action needed.
- **The seat count is not.** Nothing counts seats sold, so watch enrolment emails and change the `until` date in `src/content/programs.ts` once the early-bird seats are gone. Publishing a seat cap you do not honour is worse than not offering one.
- **Never extend a deadline quietly.** If you extend, say so; a deadline that always moves stops working.

## Payments

- Seats are paid online through **Razorpay**, using the same gateway as IndusLabs.
- The price is calculated on our server at the moment of payment, so an edited page cannot change what is charged.
- Every payment is verified against Razorpay's signature and then re-checked with Razorpay directly before a seat is confirmed.
- On success, the learner gets a confirmation email with cohort dates and payment ID; the team gets an enrolment notification at the enquiries inbox.
- **There is no database.** The enrolment emails and the Razorpay dashboard are the record. Keep a register per cohort from those.

## Refunds (confirmed, published)

Published at `/refunds` and confirmed on 21 Sep 2026. Handle requests against these terms, not case by case.

| Situation | Outcome |
| --- | --- |
| Cancels more than 7 days before the cohort | Full refund including GST |
| Cancels 7 days to 48 hours before | 50% refund |
| Cancels within 48 hours, or after the start | No refund |
| Asks to move cohort, 48+ hours ahead | One free transfer; early-bird price carries over; not refundable afterwards |
| We cancel or reschedule | Learner chooses a full refund or a free transfer |
| Workshop, within 7 days | Transfer only, no refund |
| Corporate | Per the signed proposal; deposit refundable up to 14 days before delivery |

Process: acknowledge within 2 working days, decide within 7, refund through Razorpay to the original method within 5–7 working days. We absorb the gateway fee. Log every refund against the cohort register.

## Pricing (live)

Approved and live on the site. `SHOW_PRICES` in `src/content/programs.ts` controls whether they are shown.

| Program | Per seat | Private cohort (up to 25) |
| --- | --- | --- |
| AI Generalist Certification | ₹24,999 | from ₹3,00,000 |
| AI for Leaders | ₹39,999 | from ₹2,50,000 (up to 20 leaders) |
| AI Automation & Agents Bootcamp | ₹44,999 | from ₹4,50,000 |
| AI Foundations Workshop | ₹4,999 | from ₹1,25,000 per day (up to 40) |
| Corporate role tracks | — | from ₹2,00,000 per track |

Discount policy:

- **Early bird:** 20% off for payment two weeks before a cohort starts.
- **Groups:** 10% off for 3 or more seats from one company, 15% for 5 or more.
- **Students and career switchers:** 30% off the Generalist Certification, limited seats per cohort.
- **Bundles:** Foundations Workshop plus two role tracks, priced at 10% below the sum.
- **Payment:** 50% to confirm dates for corporate work, balance on completion. Individual seats paid in full before the first session.
- **Travel:** billed at actuals for on-site work outside Delhi NCR.
