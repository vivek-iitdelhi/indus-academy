export type Module = {
  title: string;
  hours: number;
  topics: string[];
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
  modules?: Module[];
  // Search result title and meta description for the program's own page.
  seoTitle: string;
  seoDescription: string;
  mode: "Online" | "Blended" | "Onsite";
  workloadHours?: number;
  faqs: { q: string; a: string }[];
};

export const programs: Program[] = [
  {
    slug: "ai-generalist-certification",
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
        a: "On completing the program and a capstone project reviewed by faculty. Certificates are issued by INDUS AI Private Limited.",
      },
    ],
    name: "AI Generalist Certification",
    tagline: "Become the person on your team who gets things done with AI.",
    audience: "Professionals, managers, founders and career switchers",
    duration: "4 weeks · 24 live hours",
    format: "Live online cohort · 3 evening sessions a week",
    level: "Beginner to intermediate · no coding required",
    summary:
      "A build-first certification that takes you from everyday prompting to shipping automations, agents and small AI apps, using the same tools teams rely on at work.",
    outcomes: [
      "A portfolio of working AI workflows and one reviewed capstone",
      "Confidence choosing the right model and tool for each task",
      "Automations that start saving you time in the first week",
      "An Indus AI Academy certificate backed by real, assessed work",
    ],
    modules: [
      {
        title: "How modern AI actually works",
        hours: 2,
        topics: [
          "Tokens, context windows and why models hallucinate",
          "Choosing between GPT, Claude, Gemini and open models",
          "Cost, speed and privacy trade-offs",
        ],
      },
      {
        title: "Prompting and context engineering",
        hours: 3,
        topics: [
          "Structured prompts, examples and rubrics",
          "Giving models the right context from your documents",
          "Reusable prompt libraries for your role",
        ],
      },
      {
        title: "AI for research, writing and analysis",
        hours: 3,
        topics: [
          "Deep-research workflows with source checking",
          "Spreadsheet and data analysis with AI",
          "Reports, briefs and presentations in a fraction of the time",
        ],
      },
      {
        title: "No-code automation",
        hours: 4,
        topics: [
          "Triggers, actions and integrations in n8n and Make",
          "Connecting email, CRM, sheets and chat",
          "Error handling and human-in-the-loop review",
        ],
      },
      {
        title: "Building AI agents",
        hours: 4,
        topics: [
          "Tools, memory and multi-step reasoning",
          "Retrieval over company knowledge (RAG)",
          "Evaluating agents before you trust them",
        ],
      },
      {
        title: "Voice and multimodal AI",
        hours: 2,
        topics: [
          "Voice agents for calls and support",
          "Image, video and document understanding",
        ],
      },
      {
        title: "Vibe coding: shipping apps with AI",
        hours: 4,
        topics: [
          "From idea to working web app with AI coding tools",
          "Databases, sign-in and deployment basics",
          "Knowing when to hand over to engineers",
        ],
      },
      {
        title: "Capstone and demo day",
        hours: 2,
        topics: [
          "Solve a real problem from your own work",
          "Peer review and faculty feedback",
          "Present what you built",
        ],
      },
    ],
  },
  {
    slug: "ai-for-leaders",
    seoTitle: "AI for Leaders: Executive AI Program | Indus AI Academy",
    seoDescription:
      "Executive AI program for CXOs and business heads: AI strategy, use-case prioritization, ROI, risk and governance. In person, online or in-house.",
    mode: "Blended",
    faqs: [
      {
        q: "Do leaders need technical knowledge for AI for Leaders?",
        a: "No. The program focuses on strategy, investment decisions, risk and change management, with hands-on demonstrations rather than code.",
      },
      {
        q: "Can AI for Leaders run privately for our leadership team?",
        a: "Yes. It can run as a private in-house batch, tailored to your industry, data policies and priorities.",
      },
    ],
    name: "AI for Leaders",
    tagline: "Set direction, back the right bets and lead an AI-ready organization.",
    audience: "CXOs, business heads and senior managers",
    duration: "2 days in person or 6 live sessions",
    format: "Executive cohort or private in-house batch",
    level: "Strategic · no technical background needed",
    summary:
      "A focused executive program on what AI can and can't do for your business, how to prioritize use cases, and how to manage risk, talent and change.",
    outcomes: [
      "An AI opportunity map for your function or business",
      "A framework for vendors, build-versus-buy and ROI",
      "A governance and risk checklist you can adopt immediately",
      "A 90-day roadmap for your team",
    ],
  },
  {
    slug: "ai-automation-agents-bootcamp",
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
    ],
    name: "AI Automation & Agents Bootcamp",
    tagline: "Design, build and run AI agents and automations in production.",
    audience: "Operations, product and technical teams, developers and analysts",
    duration: "6 weeks · 36 live hours",
    format: "Live online cohort with weekly build labs",
    level: "Intermediate · basic scripting helpful",
    summary:
      "A lab-heavy bootcamp for the people who will own AI systems: orchestration, retrieval, evaluations, monitoring and cost control.",
    outcomes: [
      "Three production-grade agents, built and reviewed",
      "Patterns for RAG, tool use and multi-agent workflows",
      "Evaluation and monitoring set-ups you can reuse",
      "Deployment and cost-control playbooks",
    ],
  },
  {
    slug: "ai-foundations-workshop",
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
    ],
    name: "AI Foundations Workshop",
    tagline: "A one-day, hands-on start for anyone new to AI at work.",
    audience: "Every employee, students and first-time AI users",
    duration: "1 day · 6 hours",
    format: "In person or live online",
    level: "Beginner",
    summary:
      "A high-energy workshop that gets people using AI safely and productively the same day. Ideal as a company-wide kickoff.",
    outcomes: [
      "Everyday prompting that works",
      "Ten practical use cases for your role",
      "Safe-use guidelines for company data",
      "A personal AI toolkit, set up before you leave",
    ],
  },
];

export const flagship = programs[0];
