import type { Session } from "./programs";

/**
 * Role-based corporate tracks. Each is a private cohort for one company,
 * delivered on site or live online, and tailored to the team's own workflows.
 */
export type Track = {
  slug: string;
  name: string;
  role: string;
  tagline: string;
  summary: string;
  audience: string;
  duration: string;
  outcomes: string[];
  sessions: Session[];
  inHouseFrom: number;
  seoTitle: string;
  seoDescription: string;
};

const DEFAULT_DURATION = "4 sessions · 8 live hours";

export const tracks: Track[] = [
  {
    slug: "ai-for-sales-and-marketing",
    name: "AI for Sales & Marketing",
    role: "Sales & marketing",
    tagline: "More pipeline, less busywork.",
    summary:
      "Research, outreach, content and CRM hygiene, rebuilt around AI so your team spends its time on conversations rather than preparation.",
    audience: "Sales development, account executives, marketing and growth teams",
    duration: DEFAULT_DURATION,
    outcomes: [
      "A research and outreach workflow running on your own CRM data",
      "A content pipeline for one channel, with your brand voice",
      "Call summaries and CRM updates handled automatically",
      "Guardrails so nothing inaccurate reaches a customer",
    ],
    inHouseFrom: 200000,
    sessions: [
      {
        title: "Prospect research and personalised outreach",
        hours: 2,
        build: "A research-to-first-draft outreach workflow",
        topics: [
          "Building an account and buyer profile with AI",
          "Enriching leads from public sources",
          "Personalisation that survives a reply, not spam at scale",
        ],
      },
      {
        title: "Content and campaigns",
        hours: 2,
        build: "A content pipeline for one channel, end to end",
        topics: ["Briefs the model can actually follow", "Drafting, repurposing and localising", "Keeping brand voice and claims in check"],
      },
      {
        title: "Call and CRM intelligence",
        hours: 2,
        build: "An automation that turns a call into a CRM update",
        topics: ["Transcripts, summaries and next steps", "Pipeline hygiene without manual entry", "Spotting risk and intent in conversations"],
      },
      {
        title: "Measure, govern and scale",
        hours: 2,
        build: "A team playbook and a simple adoption dashboard",
        topics: ["What to measure: time, quality, pipeline", "Compliance and claim checking", "Rolling the workflow out to the whole team"],
      },
    ],
    seoTitle: "AI Training for Sales & Marketing Teams | Indus AI Academy",
    seoDescription:
      "Corporate AI training for sales and marketing: prospect research, personalised outreach, content pipelines and CRM intelligence, on your own data.",
  },
  {
    slug: "ai-for-operations-hr-and-finance",
    name: "AI for Operations, HR & Finance",
    role: "Operations, HR & finance",
    tagline: "Automate the repetitive work, keep the controls.",
    summary:
      "Document processing, reporting, recruiting and approvals, redesigned with AI while keeping the audit trail your auditors expect.",
    audience: "Operations, HR, finance and shared-services teams",
    duration: DEFAULT_DURATION,
    outcomes: [
      "An extraction workflow for one of your document types",
      "A monthly report drafted from your own data",
      "A recruiting and onboarding workflow that saves hours per hire",
      "Approval gates and an audit trail on every automation",
    ],
    inHouseFrom: 200000,
    sessions: [
      {
        title: "Documents and invoices",
        hours: 2,
        build: "An extraction workflow for one real document type",
        topics: ["Reading invoices, forms and contracts", "Validating against your records", "Handling exceptions and bad scans"],
      },
      {
        title: "Reporting and analysis",
        hours: 2,
        build: "A monthly report drafted from your data",
        topics: ["From raw export to commentary", "Checking numbers before they travel", "Reusable report templates"],
      },
      {
        title: "Recruiting and onboarding",
        hours: 2,
        build: "A job description, screening and onboarding pack workflow",
        topics: ["Writing JDs and screening fairly", "Structured interview support", "Onboarding documents and first-week plans"],
      },
      {
        title: "Policy, approvals and controls",
        hours: 2,
        build: "An approval-gated automation with an audit trail",
        topics: ["Which steps may never run unattended", "Logging decisions for audit", "Data handling under India's DPDPA"],
      },
    ],
    seoTitle: "AI Training for Operations, HR & Finance | Indus AI Academy",
    seoDescription:
      "Corporate AI training for operations, HR and finance teams: document processing, reporting, recruiting workflows and approval controls.",
  },
  {
    slug: "ai-for-customer-support",
    name: "AI for Customer Support & Success",
    role: "Customer support & success",
    tagline: "Faster answers, without losing the customer's trust.",
    summary:
      "Triage, drafting, knowledge and voice, applied to your real ticket history so quality goes up as handling time comes down.",
    audience: "Support, service and customer success teams",
    duration: DEFAULT_DURATION,
    outcomes: [
      "Ticket triage and draft replies running on your own history",
      "A knowledge base that answers questions accurately",
      "A chat or voice agent prototype for your top queries",
      "Quality and escalation checks your team trusts",
    ],
    inHouseFrom: 200000,
    sessions: [
      {
        title: "Ticket triage and draft replies",
        hours: 2,
        build: "A triage and drafting workflow on real past tickets",
        topics: ["Classifying and routing by intent", "Drafting replies in your tone", "Where a human must always review"],
      },
      {
        title: "A knowledge base that answers",
        hours: 2,
        build: "Retrieval over your help content, with citations",
        topics: ["Turning scattered docs into answerable knowledge", "Citations and 'I don't know'", "Keeping content current"],
      },
      {
        title: "Chat and voice agents",
        hours: 2,
        build: "A prototype agent for your five most common queries",
        topics: ["Scoping what an agent may handle", "Hand-off to a human that feels seamless", "Indian languages and code-switching"],
      },
      {
        title: "Quality, sentiment and escalation",
        hours: 2,
        build: "A quality and escalation dashboard",
        topics: ["Scoring conversations at scale", "Sentiment and churn signals", "Closing the loop with product and ops"],
      },
    ],
    seoTitle: "AI Training for Customer Support Teams | Indus AI Academy",
    seoDescription:
      "Corporate AI training for support and success teams: ticket triage, drafted replies, knowledge retrieval, chat and voice agents, and quality checks.",
  },
  {
    slug: "ai-for-managers",
    name: "AI for Managers & Team Leads",
    role: "Managers & team leads",
    tagline: "Redesign how your team works, not just how you write.",
    summary:
      "For the layer that decides how work actually happens: auditing workflows, planning with AI, coaching adoption and reporting impact.",
    audience: "Team leads, function managers and heads of department",
    duration: DEFAULT_DURATION,
    outcomes: [
      "An audit of your team's workflows, ranked by AI opportunity",
      "Planning, reporting and review routines rebuilt with AI",
      "A coaching plan for adoption inside your team",
      "An impact dashboard you can take to leadership",
    ],
    inHouseFrom: 200000,
    sessions: [
      {
        title: "Auditing your team's workflows",
        hours: 2,
        build: "A ranked list of your team's AI opportunities",
        topics: ["Mapping where hours actually go", "Scoring tasks for AI fit", "Choosing the first three to change"],
      },
      {
        title: "Planning, reporting and reviews",
        hours: 2,
        build: "AI-assisted planning and reporting routines",
        topics: ["Status reports from raw updates", "Meeting notes to decisions and owners", "Performance reviews: what AI may and may not touch"],
      },
      {
        title: "Coaching your team",
        hours: 2,
        build: "A coaching plan and a team prompt library",
        topics: ["Teaching the sceptical and the over-eager", "Shared prompt libraries", "Handling mistakes without killing adoption"],
      },
      {
        title: "Measuring impact",
        hours: 2,
        build: "An adoption and impact dashboard",
        topics: ["Baselines and honest measurement", "Reporting up without overclaiming", "Sustaining the change past month three"],
      },
    ],
    seoTitle: "AI Training for Managers & Team Leads | Indus AI Academy",
    seoDescription:
      "Corporate AI training for managers: audit team workflows, rebuild planning and reporting with AI, coach adoption and measure real impact.",
  },
  {
    slug: "ai-for-engineering-and-product",
    name: "AI for Engineering & Product",
    role: "Engineering & product",
    tagline: "Ship AI features, and ship faster with AI.",
    summary:
      "Two things at once: using AI coding tools well, and building AI into your product with the patterns that survive production.",
    audience: "Engineers, product managers, QA and platform teams",
    duration: DEFAULT_DURATION,
    outcomes: [
      "AI coding practices your team agrees on, including review rules",
      "Working patterns for LLM features in your own stack",
      "Retrieval, agents and evaluations applied to a real feature",
      "Security, cost and reliability checks before launch",
    ],
    inHouseFrom: 200000,
    sessions: [
      {
        title: "AI coding tools in a real codebase",
        hours: 2,
        build: "Team conventions for AI-assisted development",
        topics: ["Where assistants help and where they cost time", "Review rules for AI-written code", "Tests, refactors and migrations"],
      },
      {
        title: "Building with LLM APIs",
        hours: 2,
        build: "A working LLM feature in your own stack",
        topics: ["Prompt and context design in code", "Streaming, retries and timeouts", "Structured output you can trust"],
      },
      {
        title: "Retrieval, agents and evaluations",
        hours: 2,
        build: "A retrieval-backed feature with an evaluation set",
        topics: ["Retrieval patterns and their failure modes", "When to reach for an agent", "Golden sets and regression testing"],
      },
      {
        title: "Security, cost and reliability",
        hours: 2,
        build: "A pre-launch checklist for AI features",
        topics: ["Prompt injection and untrusted input", "Token cost, caching and budgets", "Observability, fallbacks and rollbacks"],
      },
    ],
    seoTitle: "AI Training for Engineering & Product Teams | Indus AI Academy",
    seoDescription:
      "Corporate AI training for engineers and product teams: AI coding practices, LLM features, retrieval and agents, evaluations, security and cost control.",
  },
];

export const trackBySlug = (slug: string) => tracks.find((track) => track.slug === slug);
