/**
 * Every program Indus AI Academy runs, session by session.
 *
 * Prices are drafted but not published: `SHOW_PRICES` stays false until the
 * numbers are signed off, and pages fall back to "Enquire for pricing".
 */
export const SHOW_PRICES = false;

export type Session = {
  title: string;
  hours: number;
  /** What the learner walks out of the session having made. */
  build: string;
  topics: string[];
  homework?: string;
};

export type Price = {
  /** Per seat, in rupees, taxes extra. */
  seat?: number;
  /** Private cohort for one company, in rupees, up to 25 participants. */
  inHouseFrom?: number;
  note?: string;
};

export type Program = {
  slug: string;
  name: string;
  tagline: string;
  audience: string;
  duration: string;
  format: string;
  level: string;
  summary: string;
  outcomes: string[];
  prerequisites: string;
  certification: string;
  assessment: string;
  sessions: Session[];
  price: Price;
  seoTitle: string;
  seoDescription: string;
  mode: "Online" | "Blended" | "Onsite";
  workloadHours?: number;
  faqs: { q: string; a: string }[];
};

export const programs: Program[] = [
  {
    slug: "ai-generalist-certification",
    name: "AI Generalist Certification",
    tagline: "Become the person on your team who gets things done with AI.",
    audience: "Professionals, managers, founders and career switchers",
    duration: "4 weeks · 12 sessions · 24 live hours",
    format: "Live online cohort · 3 evening sessions a week (7–9 PM IST)",
    level: "Beginner to intermediate · no coding required",
    summary:
      "A build-first certification that takes you from everyday prompting to shipping automations, agents and small AI apps, using the same tools teams rely on at work.",
    prerequisites:
      "Comfort with everyday office software. No coding, statistics or machine-learning background needed. You will need a laptop and free accounts on the tools we use.",
    certification:
      "Indus AI Academy certificate, issued by INDUS AI Private Limited, awarded on attendance of at least 9 of 12 sessions and a reviewed capstone.",
    assessment:
      "Weekly build exercises reviewed by faculty, plus a capstone solving a real problem from your own work, presented on demo day.",
    outcomes: [
      "A portfolio of working AI workflows and one reviewed capstone",
      "Confidence choosing the right model and tool for each task",
      "Automations that start saving you time in the first week",
      "An Indus AI Academy certificate backed by real, assessed work",
    ],
    price: { seat: 24999, inHouseFrom: 300000, note: "Early-bird and group discounts available." },
    sessions: [
      {
        title: "How modern AI actually works",
        hours: 2,
        build: "A model-selection cheat sheet for your own role",
        topics: [
          "Tokens, context windows and why models hallucinate",
          "Choosing between GPT, Claude, Gemini and open models",
          "Cost, speed and privacy trade-offs at work",
        ],
        homework: "Run the same task on two models and write down where each one failed.",
      },
      {
        title: "Prompting foundations",
        hours: 2,
        build: "Five reusable prompts for tasks you do every week",
        topics: [
          "Structure: role, task, context, constraints, format",
          "Examples and rubrics that raise output quality",
          "Iterating instead of starting over",
        ],
        homework: "Turn your three most repeated requests into saved prompts.",
      },
      {
        title: "Context engineering",
        hours: 2,
        build: "A prompt pack that works with your own documents",
        topics: [
          "Feeding documents, spreadsheets and policies into a model",
          "Chunking long inputs and keeping answers grounded",
          "When context beats a better model",
        ],
        homework: "Build a context pack for one recurring process you own.",
      },
      {
        title: "Research and verification",
        hours: 2,
        build: "A sourced research brief on a topic from your work",
        topics: [
          "Deep-research workflows across tools",
          "Checking claims, dates and numbers against sources",
          "Recognising confident, wrong answers",
        ],
        homework: "Fact-check an AI-written brief and log every correction.",
      },
      {
        title: "Writing that sounds like you",
        hours: 2,
        build: "Templates for your reports, proposals and updates",
        topics: [
          "Capturing voice and house style in a prompt",
          "Drafting, editing and shortening long documents",
          "Translation and Hinglish-to-English polish",
        ],
        homework: "Rewrite a real document with your template and compare time taken.",
      },
      {
        title: "Data and spreadsheets",
        hours: 2,
        build: "An analysis of a real export from your systems",
        topics: [
          "Cleaning and reshaping messy data with AI",
          "Asking questions of a spreadsheet safely",
          "Charts, summaries and the errors to watch for",
        ],
        homework: "Produce one chart and one insight from your own data.",
      },
      {
        title: "Automation foundations",
        hours: 2,
        build: "Your first working automation, end to end",
        topics: [
          "Triggers, actions and connections in n8n and Make",
          "Connecting email, sheets, chat and CRM",
          "Testing safely before you switch it on",
        ],
        homework: "Automate one task you currently do by hand every week.",
      },
      {
        title: "Automation with AI steps",
        hours: 2,
        build: "A workflow that classifies, extracts and drafts",
        topics: [
          "AI steps inside automations: classify, extract, summarise",
          "Human-in-the-loop approval before anything is sent",
          "Error handling, retries and alerts",
        ],
        homework: "Add an approval step and a failure alert to your automation.",
      },
      {
        title: "Building AI agents, part 1",
        hours: 2,
        build: "A simple agent that uses two tools",
        topics: ["What makes an agent different from a chatbot", "Tools, instructions and limits", "Planning and multi-step tasks"],
        homework: "Give your agent a third tool and note where it goes wrong.",
      },
      {
        title: "Building AI agents, part 2",
        hours: 2,
        build: "A knowledge assistant over your own documents",
        topics: [
          "Retrieval over company knowledge, in plain terms",
          "Testing an agent on real examples before trusting it",
          "Deciding what an agent may never do alone",
        ],
        homework: "Write ten test questions and score your assistant on them.",
      },
      {
        title: "Vibe coding: shipping a small app",
        hours: 2,
        build: "A working internal tool, deployed and shareable",
        topics: [
          "From idea to app with AI coding tools",
          "Data, sign-in and deployment basics",
          "Knowing when to hand over to engineers",
        ],
        homework: "Share your app with a colleague and collect their feedback.",
      },
      {
        title: "Capstone and demo day",
        hours: 2,
        build: "Your finished capstone, presented to the cohort",
        topics: ["Polishing your capstone", "Measuring the time or quality gained", "Presenting your work and next steps"],
      },
    ],
    seoTitle: "AI Generalist Certification Course | Indus AI Academy",
    seoDescription:
      "4-week live online AI certification for professionals: prompting, automation, AI agents and vibe coding. 24 hands-on hours, no coding needed.",
    mode: "Online",
    workloadHours: 24,
    faqs: [
      {
        q: "Who is the AI Generalist Certification for?",
        a: "Working professionals, managers, founders and career switchers who want practical AI skills they can use at work. No coding background is required.",
      },
      {
        q: "What will I build during the course?",
        a: "Prompt libraries, no-code automations, an AI agent, a small AI-built web app, and a capstone project that solves a real problem from your own work.",
      },
      {
        q: "How is the certificate awarded?",
        a: "On attending at least 9 of the 12 sessions and completing a capstone project reviewed by faculty. Certificates are issued by INDUS AI Private Limited.",
      },
      {
        q: "What if I miss a session?",
        a: "Every session is recorded and shared with the cohort, and faculty hold a weekly doubt-clearing hour, so you can catch up without falling behind.",
      },
    ],
  },
  {
    slug: "ai-for-leaders",
    name: "AI for Leaders",
    tagline: "Set direction, back the right bets and lead an AI-ready organization.",
    audience: "CXOs, business heads and senior managers",
    duration: "6 sessions · 12 live hours, or 2 days in person",
    format: "Executive cohort or private in-house batch",
    level: "Strategic · no technical background needed",
    summary:
      "A focused executive program on what AI can and can't do for your business, how to prioritize use cases, and how to manage risk, talent and change.",
    prerequisites: "None. Bring one business problem you would like AI to solve, and your current org chart.",
    certification: "Indus AI Academy certificate of completion, issued by INDUS AI Private Limited.",
    assessment:
      "Each session produces one artefact. By the end you hold an opportunity map, a governance checklist and a 12-month roadmap for your business.",
    outcomes: [
      "An AI opportunity map for your function or business",
      "A framework for vendors, build-versus-buy and ROI",
      "A governance and risk checklist you can adopt immediately",
      "A 90-day plan and a 12-month roadmap for your team",
    ],
    price: { seat: 39999, inHouseFrom: 250000, note: "In-house price covers one leadership team, up to 20 people." },
    sessions: [
      {
        title: "What AI can and cannot do in 2026",
        hours: 2,
        build: "A myth-versus-reality brief for your leadership team",
        topics: [
          "Capabilities and limits, demonstrated live",
          "Where costs actually land: licences, integration, people",
          "Reading vendor claims critically",
        ],
      },
      {
        title: "Finding the value: use-case discovery",
        hours: 2,
        build: "An opportunity map for your function, scored and ranked",
        topics: [
          "Spotting frequent, language-heavy, measurable work",
          "Scoring by value, feasibility and risk",
          "Saying no to the interesting but pointless",
        ],
      },
      {
        title: "Build, buy or partner",
        hours: 2,
        build: "A vendor evaluation scorecard for your shortlist",
        topics: [
          "What to build in-house and what never to",
          "Evaluating vendors on data, lock-in and support",
          "Total cost over three years, not the licence fee",
        ],
      },
      {
        title: "Risk, governance and data",
        hours: 2,
        build: "A first draft of your organization's AI use policy",
        topics: [
          "India's DPDPA, data residency and customer consent",
          "Approval gates and human oversight by risk level",
          "Incidents: detection, escalation and disclosure",
        ],
      },
      {
        title: "People, skills and change",
        hours: 2,
        build: "A 90-day enablement plan for your teams",
        topics: [
          "Which roles change first, and how",
          "Champions, incentives and internal communication",
          "Handling fear about job losses honestly",
        ],
      },
      {
        title: "Roadmap, metrics and the board",
        hours: 2,
        build: "A 12-month roadmap with the metrics you will report",
        topics: [
          "Sequencing pilots, platform and scale",
          "Metrics that survive scrutiny",
          "Telling the AI story to your board and customers",
        ],
      },
    ],
    seoTitle: "AI for Leaders: Executive AI Program | Indus AI Academy",
    seoDescription:
      "Executive AI program for CXOs and business heads: AI strategy, use-case prioritization, ROI, risk and governance. In person, online or in-house.",
    mode: "Blended",
    workloadHours: 12,
    faqs: [
      {
        q: "Do leaders need technical knowledge for AI for Leaders?",
        a: "No. The program focuses on strategy, investment decisions, risk and change management, with hands-on demonstrations rather than code.",
      },
      {
        q: "Can AI for Leaders run privately for our leadership team?",
        a: "Yes. It can run as a private in-house batch, tailored to your industry, data policies and priorities, over two days or six sessions.",
      },
      {
        q: "What do we leave with?",
        a: "Six artefacts: a capability brief, a scored opportunity map, a vendor scorecard, a draft AI policy, a 90-day enablement plan and a 12-month roadmap.",
      },
    ],
  },
  {
    slug: "ai-automation-agents-bootcamp",
    name: "AI Automation & Agents Bootcamp",
    tagline: "Design, build and run AI agents and automations in production.",
    audience: "Operations, product and technical teams, developers and analysts",
    duration: "6 weeks · 12 sessions · 36 live hours",
    format: "Live online cohort · 2 sessions a week with build labs",
    level: "Intermediate · basic scripting helpful",
    summary:
      "A lab-heavy bootcamp for the people who will own AI systems: orchestration, retrieval, evaluations, monitoring and cost control.",
    prerequisites:
      "Comfort reading JSON and calling an API, or having automated something before in n8n, Zapier or a scripting language. You will need accounts with an AI provider and a place to deploy.",
    certification:
      "Indus AI Academy certificate, issued by INDUS AI Private Limited, awarded on three reviewed builds and a production-ready capstone agent.",
    assessment:
      "Three graded builds during the program, plus a capstone agent reviewed against a rubric covering reliability, evaluation, guardrails and cost.",
    outcomes: [
      "Three production-grade agents, built and reviewed",
      "Patterns for RAG, tool use and multi-agent workflows",
      "Evaluation and monitoring set-ups you can reuse",
      "Deployment and cost-control playbooks",
    ],
    price: { seat: 44999, inHouseFrom: 450000, note: "Team pricing available for four or more seats." },
    sessions: [
      {
        title: "Agent architectures",
        hours: 3,
        build: "A working agent loop with two tools",
        topics: ["Model, tools, instructions, memory", "When an agent beats a fixed workflow", "Failure modes to design around"],
        homework: "Re-run your agent on ten inputs and record every failure.",
      },
      {
        title: "Tool design and APIs",
        hours: 3,
        build: "Three reliable tools with clean schemas",
        topics: ["Designing tool inputs a model can get right", "Errors, timeouts and retries", "Rate limits and idempotency"],
      },
      {
        title: "Retrieval over your own knowledge",
        hours: 3,
        build: "A retrieval layer over real company documents",
        topics: ["Chunking, embeddings and hybrid search", "Citations and grounding", "Keeping the index fresh"],
        homework: "Measure answer quality before and after retrieval tuning.",
      },
      {
        title: "Memory and state",
        hours: 3,
        build: "An agent that holds context across a conversation",
        topics: ["Short-term versus long-term memory", "Threads, sessions and user state", "Forgetting on purpose, and privacy"],
      },
      {
        title: "Orchestration and multi-agent workflows",
        hours: 3,
        build: "A two-agent workflow with routing",
        topics: ["Routing, planning and hand-offs", "When multi-agent helps and when it hurts", "Queues and long-running work"],
      },
      {
        title: "Evaluations",
        hours: 3,
        build: "An evaluation harness with a golden set",
        topics: ["Building a golden set from real cases", "Model-as-judge, and its limits", "Regression testing before each change"],
        homework: "Add twenty cases to your golden set and run a regression.",
      },
      {
        title: "Guardrails and safety",
        hours: 3,
        build: "A guardrail layer around your agent",
        topics: ["PII detection and redaction", "Prompt injection and untrusted content", "Approval gates for risky actions"],
      },
      {
        title: "Voice agents",
        hours: 3,
        build: "A working voice agent prototype",
        topics: [
          "Speech to text and text to speech pipelines",
          "Latency budgets for natural conversation",
          "Indian languages, accents and code-switching",
        ],
      },
      {
        title: "Integrations with real systems",
        hours: 3,
        build: "An agent connected to a CRM or helpdesk",
        topics: ["Webhooks, queues and back-pressure", "Auth, secrets and least privilege", "Writing back safely"],
      },
      {
        title: "Deployment",
        hours: 3,
        build: "Your agent deployed and reachable",
        topics: ["Hosting choices and environments", "Secrets, config and rollbacks", "Cost control and budgets"],
      },
      {
        title: "Monitoring and iteration",
        hours: 3,
        build: "Tracing, alerts and a triage runbook",
        topics: ["Tracing every step of a run", "Triaging failures from real traffic", "Feedback loops that improve the agent"],
      },
      {
        title: "Capstone review",
        hours: 3,
        build: "Your capstone agent, reviewed against the rubric",
        topics: ["Reliability and evaluation review", "Cost and latency review", "Hand-over documentation"],
      },
    ],
    seoTitle: "AI Agents & Automation Bootcamp | Indus AI Academy",
    seoDescription:
      "6-week live bootcamp to design, build and run AI agents and automations in production: RAG, tool use, evaluations, monitoring and cost control.",
    mode: "Online",
    workloadHours: 36,
    faqs: [
      {
        q: "What background do I need for the AI Automation & Agents Bootcamp?",
        a: "Basic comfort with scripting helps. The bootcamp is built for operations, product and technical teams, developers and analysts who will own AI systems.",
      },
      {
        q: "What will I have built by the end of the bootcamp?",
        a: "Three production-grade agents, built and reviewed, plus reusable patterns for retrieval, evaluation, monitoring, deployment and cost control.",
      },
      {
        q: "Which tools and models does it use?",
        a: "Provider-neutral. We work with the major hosted models and open alternatives, orchestration in n8n and code, and the observability tools teams actually run.",
      },
    ],
  },
  {
    slug: "ai-foundations-workshop",
    name: "AI Foundations Workshop",
    tagline: "A one-day, hands-on start for anyone new to AI at work.",
    audience: "Every employee, students and first-time AI users",
    duration: "1 day · 4 sessions · 6 live hours",
    format: "In person at your office, or live online",
    level: "Beginner",
    summary:
      "A high-energy workshop that gets people using AI safely and productively the same day. Ideal as a company-wide kickoff.",
    prerequisites: "None. Bring a laptop and examples of the work you do most often.",
    certification: "Certificate of participation, issued by INDUS AI Private Limited.",
    assessment:
      "No formal assessment. Everyone leaves with a personal AI toolkit and at least three prompts working on their own tasks.",
    outcomes: [
      "Everyday prompting that works",
      "Ten practical use cases for your role",
      "Safe-use guidelines for company data",
      "A personal AI toolkit, set up before you leave",
    ],
    price: { seat: 4999, inHouseFrom: 125000, note: "In-house day covers up to 40 participants at your office." },
    sessions: [
      {
        title: "What AI can do for your role",
        hours: 1.5,
        build: "A shortlist of ten tasks in your job AI can help with",
        topics: ["Live demonstrations across functions", "What it is bad at, honestly", "Setting up your accounts and tools"],
      },
      {
        title: "Prompting that works",
        hours: 1.5,
        build: "Three prompts running on your own real tasks",
        topics: ["The structure of a good request", "Giving context and examples", "Fixing a bad answer instead of retyping"],
      },
      {
        title: "Everyday wins: writing, research, data",
        hours: 1.5,
        build: "A finished piece of your own work, done with AI",
        topics: ["Emails, notes and documents", "Quick research with source checking", "Spreadsheets and summaries"],
      },
      {
        title: "Safe use and your personal toolkit",
        hours: 1.5,
        build: "Your saved prompt library and a safety checklist",
        topics: ["What company data may go where", "Spotting and correcting wrong answers", "Building a habit that lasts past today"],
      },
    ],
    seoTitle: "AI Foundations Workshop for Teams | Indus AI Academy",
    seoDescription:
      "One-day, hands-on AI workshop for employees and first-time AI users: everyday prompting, practical use cases and safe use of company data.",
    mode: "Blended",
    workloadHours: 6,
    faqs: [
      {
        q: "Is the AI Foundations Workshop suitable as a company-wide kickoff?",
        a: "Yes. It is designed to get every employee using AI safely and productively on the same day, and works well before role-based tracks.",
      },
      {
        q: "Can the workshop be delivered at our office?",
        a: "Yes. It runs in person at your office anywhere in India, or as a live online session.",
      },
      {
        q: "How many people can attend?",
        a: "Up to 40 people in one in-house day. Larger organizations usually run several days, department by department.",
      },
    ],
  },
];

export const flagship = programs[0];

export const programBySlug = (slug: string) => programs.find((program) => program.slug === slug);

export const totalHours = (program: Program) =>
  program.sessions.reduce((sum, session) => sum + session.hours, 0);

export const formatPrice = (rupees: number) => `₹${rupees.toLocaleString("en-IN")}`;
