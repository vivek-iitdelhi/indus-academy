import { company, founder, site } from "./site";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const LAST_UPDATED = "2026-09-21";
const ENTITY = `${company.legalName} ("Indus AI Academy", "we", "us")`;

export const terms: LegalDocument = {
  slug: "terms",
  title: "Terms and Conditions",
  description:
    "The terms on which Indus AI Academy, operated by INDUS AI Private Limited, provides training programs, workshops and consulting services.",
  updated: LAST_UPDATED,
  intro: `These terms govern your use of ${site.url.replace("https://", "")} and any program, workshop or service you buy from ${ENTITY}, with its registered office in ${company.location}.`,
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `Indus AI Academy is the training and consulting business of ${company.legalName}, incorporated in India in ${company.founded}. You can reach us at ${site.email}.`,
      ],
    },
    {
      heading: "What we provide",
      paragraphs: [
        "We provide live, instructor-led AI training programs for individuals and organizations, one-day workshops, and AI consulting engagements. Session counts, hours and schedules are as published on the relevant program page at the time you book.",
        "Programs are educational. They do not guarantee any job, salary, business result or examination outcome, and nothing we teach is legal, financial, tax or medical advice.",
      ],
    },
    {
      heading: "Booking a seat",
      list: [
        "A seat is confirmed only when payment is received in full and we have sent you a confirmation email.",
        "Seats are limited per cohort and allocated in order of confirmed payment.",
        "Prices shown are per seat and exclude GST, which is charged as applicable.",
        "Early-bird prices apply until the date shown on the program page, or until the stated number of early-bird seats is taken, whichever comes first.",
        "You must provide accurate name, email and phone details. Certificates are issued in the name you provide at booking.",
      ],
    },
    {
      heading: "How and when services are delivered",
      paragraphs: [
        "Everything we sell is a service delivered live, not a physical product, so nothing is shipped.",
      ],
      list: [
        "Within minutes of payment you receive a confirmation email with your cohort dates, schedule and payment reference.",
        "Joining details, the welcome pack and pre-work are emailed at least 7 days before the first session, or within 24 hours if you book later than that.",
        "Sessions are delivered live online at the times published on the program page, in Indian Standard Time. In-person and on-site sessions are delivered at the venue agreed in writing.",
        "Session recordings are shared within 24 hours of each session and stay available to your cohort for 6 months.",
        "Certificates are issued by email within 10 working days of the program ending, once attendance and assessed work are confirmed.",
        "Corporate engagements are delivered on the dates set out in the signed proposal or statement of work.",
      ],
    },
    {
      heading: "Changes to a program",
      paragraphs: [
        "We may adjust session dates, timings, the order of the curriculum or the faculty assigned, and will tell you as early as we can. If we cancel a cohort or reschedule it so that you can no longer attend, you may take a free transfer to a later cohort or a full refund, as set out in our Refunds and Cancellations policy.",
      ],
    },
    {
      heading: "Your responsibilities",
      list: [
        "Attend live sessions and complete the practice work if you want to be certified.",
        "Use your own accounts for the tools used in class, and comply with those tools' own terms.",
        "Do not share session links, recordings or course materials with anyone outside your cohort.",
        "Do not upload other people's personal data, or confidential information belonging to your employer or clients, into exercises without permission.",
        "Behave professionally towards faculty and other participants. We may remove anyone who does not, without refund.",
      ],
    },
    {
      heading: "Certification",
      paragraphs: [
        "Certificates are issued by INDUS AI Private Limited on completion of the attendance requirement and any assessed work stated on the program page. A certificate records completion of our program. It is not a university degree, a government qualification or an accreditation by any regulator.",
      ],
    },
    {
      heading: "Course materials and intellectual property",
      paragraphs: [
        "Curricula, slides, templates, recordings and exercises remain our property. You get a personal, non-transferable licence to use them for your own learning and work. You may not resell them, teach from them commercially, or publish them.",
        "Work you build during a program belongs to you.",
      ],
    },
    {
      heading: "Corporate engagements",
      paragraphs: [
        "Corporate training and consulting are governed by the proposal or statement of work signed with your organization. Where that document and these terms conflict, that document prevails.",
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        "We deliver our programs with reasonable skill and care. To the extent permitted by law, our total liability to you for any claim connected with a program is limited to the fees you paid for it, and we are not liable for indirect or consequential loss, including lost profits or business interruption.",
        "AI tools used in class are operated by third parties. Their availability, pricing and behaviour are outside our control.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        `These terms are governed by the laws of India. The courts at Gautam Buddha Nagar, Uttar Pradesh, have exclusive jurisdiction, subject to any statutory right you have as a consumer to approach a forum where you reside.`,
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about these terms: ${site.email}. ${company.legalName}, ${company.location}.`],
    },
  ],
};

export const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  description:
    "What personal data Indus AI Academy collects, why we collect it, who processes it, and the rights you have under India's Digital Personal Data Protection Act.",
  updated: LAST_UPDATED,
  intro: `${ENTITY} respects your privacy. This policy explains what we collect when you use ${site.url.replace("https://", "")}, enquire, subscribe or enrol, and what you can ask us to do about it.`,
  sections: [
    {
      heading: "What we collect",
      list: [
        "Enquiries: your name, work email, and optionally company, role, team size and your message.",
        "Newsletter: your email address, and the fact that you confirmed your subscription.",
        "Enrolment: your name, email, phone number, the program you bought, and the payment reference returned by our payment gateway.",
        "Server logs: our hosting provider records standard request data such as IP address and browser type, for security and reliability.",
      ],
      paragraphs: [
        "We do not run advertising trackers or third-party analytics on this website, and we do not sell personal data to anyone.",
      ],
    },
    {
      heading: "Card details",
      paragraphs: [
        "We never see or store your card, UPI or bank details. Payments are processed by Razorpay, which is certified to handle them. We receive only a payment identifier and the amount.",
      ],
    },
    {
      heading: "Why we use your data",
      list: [
        "To answer your enquiry and send you the program information you asked for.",
        "To confirm your seat, deliver the program, and issue your certificate.",
        "To send the weekly newsletter, if you subscribed, until you unsubscribe.",
        "To meet legal, tax and accounting obligations.",
      ],
    },
    {
      heading: "Who processes it for us",
      list: [
        "Vercel, for website hosting and server logs.",
        "Resend, for sending enquiry, enrolment and newsletter emails.",
        "Razorpay, for processing payments.",
        "Zoho, for our email inbox.",
      ],
      paragraphs: [
        "These providers process data on our instructions. Some store data outside India; where that happens it is under contractual protections offered by that provider.",
      ],
    },
    {
      heading: "How long we keep it",
      list: [
        "Enquiries: up to 24 months from your last contact with us.",
        "Newsletter subscribers: until you unsubscribe, plus a record of the unsubscribe.",
        "Enrolment and payment records: as long as tax and company law require, currently eight years.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Under India's Digital Personal Data Protection Act, 2023, you may ask us to confirm what data of yours we hold, correct it, or erase it where we are not required to keep it. You may withdraw consent for marketing at any time, and every newsletter has a one-click unsubscribe link.",
        `To exercise any of these, write to ${site.email} from the address you gave us.`,
      ],
    },
    {
      heading: "Grievance officer",
      paragraphs: [
        `${founder.name}, ${company.legalName}, ${company.location}. Email: ${site.email}. We respond to privacy grievances within 30 days.`,
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "The site runs over HTTPS, payment verification happens on our servers, and access to our email and payment dashboards is restricted to the people who need it. No system is perfectly secure, so please do not send us sensitive personal information by email.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "If we change this policy we will update the date at the top of this page. Material changes will also be mentioned in the newsletter.",
      ],
    },
  ],
};

export const refunds: LegalDocument = {
  slug: "refunds",
  title: "Refunds and Cancellations",
  description:
    "Cancellation, transfer and refund terms for Indus AI Academy programs, workshops and corporate training.",
  updated: LAST_UPDATED,
  intro:
    "We would rather you attend than get a refund, so transfers are free and generous. Where a refund is due, these are the terms.",
  sections: [
    {
      heading: "Individual seats: cancelling",
      list: [
        "More than 7 days before the first session: full refund, including GST.",
        "Between 7 days and 48 hours before the first session: 50% refund.",
        "Within 48 hours of the first session, or after the program has started: no refund.",
      ],
      paragraphs: [
        "Write to us from your registered email address to cancel. The date we receive your email is the date we use.",
      ],
    },
    {
      heading: "Transfers",
      paragraphs: [
        "You may transfer once to a later cohort of the same program, free of charge, if you ask at least 48 hours before your cohort starts. A transferred seat is not refundable afterwards, and early-bird pricing carries over.",
      ],
    },
    {
      heading: "If we cancel or reschedule",
      paragraphs: [
        "If we cancel a cohort, or move it so that you can no longer attend, you choose: a free transfer to a later cohort, or a full refund including GST. This applies regardless of how close to the start date it happens.",
      ],
    },
    {
      heading: "One-day workshops",
      list: [
        "More than 7 days before the workshop: full refund.",
        "Within 7 days: transfer to a later date, but no refund.",
      ],
    },
    {
      heading: "Corporate training and consulting",
      paragraphs: [
        "Corporate engagements follow the signed proposal or statement of work. Unless that document says otherwise: the booking deposit is refundable up to 14 days before the first agreed delivery date, dates moved with less than 7 days' notice may incur the cost of faculty time already committed, and preparation work already delivered is chargeable.",
      ],
    },
    {
      heading: "How refunds are paid",
      paragraphs: [
        "Refunds go back to the original payment method through Razorpay, normally within 5 to 7 working days of approval, and we absorb the payment gateway charge. Your bank may take a few days more to show it.",
      ],
    },
    {
      heading: "Not eligible for refund",
      list: [
        "Missing sessions you were enrolled in, since recordings are provided.",
        "Removal from a program for breaching our terms.",
        "Course materials already downloaded, where you cancel after the program has started.",
      ],
    },
    {
      heading: "Raising a request",
      paragraphs: [
        `Email ${site.email} with your name, the program, and your payment reference. We acknowledge within 2 working days and decide within 7.`,
      ],
    },
  ],
};

export const legalDocuments = [terms, privacy, refunds];
