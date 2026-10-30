# Learner experience: what good platforms do, and why

From a review on 2026-10-30 of Udemy, Coursera, LinkedIn Learning, Skillshare, PhysicsWallah,
Unacademy, upGrad, Great Learning, Scaler, Skill India Digital Hub, SWAYAM, Vedantu, Teachable,
Thinkific, Kajabi, Podia, Maven, Circle, Duolingo, Khan Academy, Brilliant and Google Skillshop,
plus Nielsen Norman Group research. It came from public docs and write-ups; nobody saw their
logged-in screens, so treat it as direction rather than measurement. "Why" is a stated reason
where one is linked, otherwise a reasonable reading of the pattern.

## The one idea

A visitor is deciding whether to buy. A learner already decided and came back to do something.
Those are two different jobs, so they get two different sites.

## Patterns, and why they exist

| Pattern | Why | Evidence |
| --- | --- | --- |
| Login replaces the sales site with a personal area | Returning users have a task, not a buying decision | Thinkific's Learner Hub drops the site header; Teachable sets a separate home for logged-in users; [Unacademy](https://thehardcopy.co/unacademy-rewrites-the-book/) |
| One obvious next step at the top | Learners were unsure what to do next | [Duolingo](https://blog.duolingo.com/new-duolingo-home-screen-design), [Khan Academy](https://blog.khanacademy.org/?p=21322); [Coursera](https://blog.coursera.org/new-progress-tracking-features-on-coursera) reports 10%+ better completion from a progress bar and next step (their figure, no method given) |
| Buy turns into Continue once you own a course | A price means nothing to an owner | Coursera, Udemy, Kajabi hides owned offers |
| Labelled bottom tabs on phones, no hidden menu | Hidden navigation gets used far less | [NN/g](https://www.nngroup.com/articles/hamburger-menus/): 57% vs 86% on mobile; [Unacademy](https://thehardcopy.co/unacademy-rewrites-the-book/) removed its hamburger for this reason |
| Words beside icons | Only home, print and search are widely understood alone | [NN/g](https://www.nngroup.com/articles/icon-usability/) |
| Join appears shortly before class, then becomes the recording | The main action should match the moment | [Maven](https://help.maven.com/en/articles/9081204-student-home) |
| Certificates in the learner's own area | People look for them later, away from the course | Coursera, LinkedIn, and complaints about buried certificates on Indian platforms |
| Useful empty state: why it is empty, what to do | An empty screen is a dead end | [NN/g](https://nngroup.com/articles/empty-state-interface-design); mismatched emails are the usual cause of "my course is missing" ([Podia](https://help.podia.com/en/articles/11370856-troubleshooting-member-login-issues)) |
| Flat screens, plain and familiar words, few bytes | First-time users struggle with menus, and data is expensive | [Medhi et al.](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ToCHI2711_Medhi.pdf), [Google](https://design.google/library/connectivity-culture-and-credit) |

## What we changed (2026-10-30)

- Signed-in header: My courses, Browse, Certificates, Account, in place of the sales menu.
- Phones: four labelled bottom tabs, hidden in the lesson player and live class.
- `/` sends anyone signed in to `/learn` (`src/proxy.ts`).
- `/learn`: one Continue card, at most two upcoming classes that link to their room and refresh
  themselves near class time, courses sorted by most recently studied, and an empty state with
  the catalogue and a "different email?" hint.
- A course page you own goes straight to the course.

## Not done yet

- Hindi or Hinglish interface. Needed once BLS learners use the site directly; Hindi first, with
  familiar English words kept ("Certificate", "Live class").
- Phone OTP or WhatsApp sign-in, for people without a working email.
- Certificate progress card ("1 class left"), and resuming the last lesson watched instead of
  the first unfinished one.
- A free lesson without signing in.
- Lower-data class mode (audio only), if webinar.gg can do it.
