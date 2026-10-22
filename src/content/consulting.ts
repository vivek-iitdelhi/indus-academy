export const offerings = [
  {
    name: "AI strategy & readiness",
    description: "Assess your data, systems and skills, and find where AI will pay off first.",
  },
  {
    name: "Use-case discovery",
    description: "Workshops with your teams to find, size and prioritize opportunities.",
  },
  {
    name: "Build & integrate",
    description: "Agents, automations, voice AI and copilots, integrated with the stack you already run.",
  },
  {
    name: "Governance & responsible AI",
    description: "Policies, risk controls and review processes that let teams move fast, safely.",
  },
  {
    name: "Enablement",
    description: "Train the people who will run and extend what we build together.",
  },
];

export const phases = [
  {
    name: "Discovery sprint",
    duration: "2–3 weeks",
    description: "An opportunity map, business cases and a prioritized roadmap.",
  },
  {
    name: "Pilot",
    duration: "6–8 weeks",
    description: "One high-value use case built, measured and in the hands of real users.",
  },
  {
    name: "Scale",
    duration: "Ongoing",
    description: "Roll-out, integration, monitoring and team enablement.",
  },
];

export const buildExamples = [
  "Customer support agents",
  "Voice agents for inbound and outbound calls",
  "Sales and CRM automation",
  "Document and invoice intelligence",
  "Internal knowledge copilots",
  "Reporting and analytics assistants",
];

/** The paid discovery call booked at /consulting/book. Times are India time. */
export const discoveryCall = {
  name: "AI discovery call",
  minutes: 30,
  /** Rupees, before GST. */
  listPrice: 9999,
  /** What we charge now (before GST): 50% launch discount. Set to listPrice to end it. */
  price: 4999,
  /** 0 = Sunday. */
  weekdays: [1, 2, 3, 4, 5],
  startTimes: ["11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
  /** How far ahead slots are offered, and the least notice we accept. */
  daysAhead: 14,
  minNoticeHours: 24,
  /** "YYYY-MM-DD" days off (holidays, travel). */
  blockedDates: [] as string[],
};
