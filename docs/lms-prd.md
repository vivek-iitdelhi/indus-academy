# LMS — product requirements

Companion to [`lms-plan.md`](lms-plan.md), which covers architecture and the decisions
behind it. This document covers what we are building and how we will know it works.

Written 19 October 2026.

## Why

Indus AI Academy sells live cohorts at ₹24,999–44,999. Three things follow from that:

- **Nothing can be bought without a human.** Every sale needs a conversation.
- **The October cohort took no registrations**, and cohort dates have moved to November.
- **The blog publishes two articles a day and the newsletter goes out weekly**, and
  neither has anything to convert a reader into except a ₹25,000 commitment.

A self-serve course at ₹999–2,999 closes that gap. It is an order of magnitude easier
to say yes to, it runs without anyone's calendar, and it gives the content engine a
destination.

## What success looks like

| Measure | Target for the first 90 days |
| --- | --- |
| Signups | 200 |
| Paid conversions | 40 |
| Course completion rate | 30% of paid learners |
| Certificates issued | 12 |
| Certificates added to LinkedIn | 6 |

These are deliberately small. The purpose of Phase 1 is to prove the loop works end to
end with real money, not to hit revenue.

## Who it is for

**The learner.** An Indian working professional, 25–40, non-technical or
semi-technical, on a phone as often as a laptop, often on a variable mobile
connection. They want a specific skill and something to show for it. They have been
burned by recorded courses they never finished.

**The admin.** Vivek and the team. Needs to see who enrolled, grant access manually
when a payment goes sideways, and issue or revoke a certificate. In Phase 1 this is
database queries, not a UI.

## Scope

### In, for Phase 1

1. **Account** — sign up and sign in by email magic link or Google. No passwords.
2. **Purchase** — buy one self-paced course with Razorpay. Enrolment granted on
   verified payment.
3. **Learn** — watch lessons in order, with progress saved as you watch and a working
   "resume where you left off".
4. **Dashboard** — the courses you own and how far through each you are.

### In, for Phase 2

5. **Certificate** — issued on completion, with a public verification page and a
   LinkedIn *Add to profile* button.

### Explicitly out, for now

Live cohort automation (still run by hand), quizzes and graded assignments, discussion
or community, a mobile app, multiple instructors, affiliate or referral, coupons,
subscriptions, and multi-currency. Each is a real feature; none is needed to prove the
loop.

## User stories and acceptance criteria

### A. Signing in

**A1.** *As a visitor, I can create an account with just my email.*
- Entering an email on `/signin` sends a magic link through Resend within 10 seconds.
- The link signs me in and expires after a single use.
- An expired or reused link shows a plain explanation and an obvious way to send a new
  one, not a stack trace.
- Signing in on a second device does not sign me out of the first.

**A2.** *As a visitor, I can use Google instead.*
- Google sign-in creates the account on first use and links to the same account by
  email on later use — one person, one account, regardless of method.

**A3.** *As a learner, I stay signed in.*
- A session survives closing the browser and lasts at least 30 days.

### B. Buying

**B1.** *As a visitor, I can see what a course contains before paying.*
- The course page lists every module and lesson title with its duration, and the total
  hours, without an account.
- Price is shown inclusive of what will be charged, with GST stated.

**B2.** *As a visitor, I can buy a course.*
- Checkout uses the existing Razorpay integration. **The price is decided server-side**
  — a tampered client cannot change what is charged.
- On success I am enrolled immediately and land in the course, not on a receipt page I
  have to navigate away from.
- I receive a confirmation email with what I bought, what I paid, and the payment
  reference.

**B3.** *As a learner, a failed or abandoned payment costs me nothing.*
- Closing the Razorpay modal leaves no enrolment and no partial record that blocks a
  retry.
- A payment that succeeds at Razorpay but fails our verification is **not** silently
  dropped: it alerts the team, because that is someone's money.

**B4.** *As someone who already owns a course, I cannot buy it twice.*
- The course page shows "Continue learning" instead of a buy button.

### C. Learning

**C1.** *As a learner, I can watch a lesson.*
- Video plays through the Gumlet player on desktop and mobile.
- Playback URLs are signed and domain-restricted. A URL copied out of the page does not
  play on another site.
- A learner who does not own the course cannot reach the lesson or its video, by URL
  guessing or otherwise.

**C2.** *As a learner, my progress is saved.*
- Position is recorded at most every 15 seconds while playing, and on pause and on
  leaving the page.
- Reopening a lesson resumes within a few seconds of where I stopped.
- A lesson counts as complete at **90% of its duration watched**, measured by furthest
  position reached — **scrubbing to the end does not complete it**.

**C3.** *As a learner, I can pick up where I left off.*
- The dashboard links straight to the next incomplete lesson.
- Course progress shows as a percentage of lessons completed.

**C4.** *As a learner on a bad connection, the player degrades rather than fails.*
- Adaptive bitrate is on; a stall does not lose saved progress.

### D. Certificate (Phase 2)

**D1.** *As a learner who finished, I get a certificate.*
- Issued automatically when every lesson in the course is complete.
- Shows my name as I entered it, the course, the issue date, a unique serial, and that
  it is issued by INDUS AI Private Limited.
- Downloadable as an image.

**D2.** *As anyone, I can verify a certificate.*
- `/verify/<serial>` is public, needs no account, and shows holder, course, issue date
  and status.
- An unknown or revoked serial says so plainly. **A certificate nobody can check is
  decoration.**

**D3.** *As a learner, I can add it to LinkedIn in one click.*
- A button opens LinkedIn's *Add to profile* flow prefilled with the course name, our
  organisation, the issue month and year, the serial, and a `certUrl` pointing at the
  verification page.

## Rules that are easy to get wrong

- **Enrolment is permanent unless given an expiry.** Self-paced purchases do not lapse.
  Cohort and free enrolments may set `expires_at`.
- **Lessons are watchable in any order.** Gating is a Phase 3 decision, not a default.
- **Completion is per lesson and derived, never manually toggled by the learner.**
- **Certificates are issued once per learner per course.** Re-completion does not mint a
  second serial.
- **A revoked certificate stays in the database.** Verification must be able to say
  "revoked" rather than "not found", because "not found" reads as a broken link.
- **Names on certificates come from the account**, and learners must be able to correct
  their name *before* issue. Reissuing because of a typo is a support cost.

## Privacy and legal

Personal data handling is already described in the published
[Privacy Policy](https://indusai.academy/privacy), which commits to no third-party
analytics and no sale of personal data. The LMS adds progress and payment records to
what we hold; both are covered by the existing retention statement, and the policy
needs a short amendment naming the new processors (Neon, Gumlet) before launch.

Refund terms are published and already cover digital services: see
[Refunds](https://indusai.academy/refunds). Self-paced course refunds need their own
clause — the existing terms are written for cohorts — and that wording is a decision
for Vivek, not a developer.

## Risk this plan does not remove

An LMS does not create demand. be10x sells a ₹929 workshop on heavy paid acquisition;
the funnel is the product and the LMS is only delivery. Building this makes a sale
*possible* without a conversation. It does not make it happen.

The first course should therefore be something the existing blog and newsletter
audience already asks about, priced to be an easy yes, and launched to that list —
not built in the hope that a catalogue attracts traffic on its own.
