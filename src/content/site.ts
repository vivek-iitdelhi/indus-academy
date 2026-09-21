import { programs } from "./programs";

export const site = {
  name: "Indus AI Academy",
  tagline: "AI training and consulting",
  description:
    "Live, hands-on AI courses and certification, corporate AI training for employees, and AI consulting for businesses in India. Founded by an IIT Delhi alumnus.",
  // NEXT_PUBLIC_SITE_URL overrides this, e.g. for preview deployments.
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://indusai.academy",
  email: "hello@indusai.academy",
};

export const founder = {
  name: "Vivek Gupta",
  role: "Founder",
  credential: "IIT Delhi alumnus",
  linkedin: "https://www.linkedin.com/in/vivekgupta668/",
  highlights: ["IIT Delhi alumnus", "PhD scholar", "AI researcher", "Serial entrepreneur", "14 years in technology"],
  venture: {
    name: "IndusLabs",
    url: "https://induslabs.io",
    blurb: "Voice AI and workflow automation for Indian businesses",
  },
  awardCaption:
    "Honoured for his work in AI by Union Cabinet Minister Shri Chirag Paswan and Governor Shri Arif Mohammed Khan.",
  previously: ["MakeMyTrip", "Goibibo", "Wissen", "Jubilant FoodWorks"],
  bio: [
    "Vivek Gupta is an IIT Delhi alumnus and PhD scholar, an AI researcher and serial entrepreneur with 14 years of building technology at MakeMyTrip, Goibibo, Wissen and Jubilant FoodWorks.",
    "As founder of IndusLabs, he leads a team building voice AI agents and workflow automation for Indian businesses. Indus AI Academy brings that same hands-on, production-grade experience to the professionals and teams learning to work with AI.",
  ],
};

// The registered company that issues Indus AI Academy certificates.
export const company = {
  legalName: "INDUS AI Private Limited",
  founded: "2023",
  location: "Noida, India",
  address: {
    street: "B-705, Bhutani Cyber Park",
    locality: "Sector 62, Noida",
    region: "Uttar Pradesh",
    postalCode: "201301",
    country: "India",
  },
  phone: "+91 81058 70564",
  phoneHref: "tel:+918105870564",
  credentials: ["DPIIT-recognized startup (Startup India)", "ISO 9001:2015 certified", "MSME registered"],
};

// One-line registered office, used in the footer, policies and transactional email.
export const companyAddress = [
  company.address.street,
  company.address.locality,
  `${company.address.region} ${company.address.postalCode}`,
  company.address.country,
].join(", ");

export type NavLink = { href: string; label: string; description?: string; external?: boolean };

export type NavItem = {
  href: string;
  label: string;
  // Items with children render as a dropdown; overviewLabel links to the section's main page.
  overviewLabel?: string;
  children?: NavLink[];
  cta?: NavLink;
};

export const nav: NavItem[] = [
  {
    href: "/programs",
    label: "Programs",
    overviewLabel: "Compare all programs",
    children: programs.map((p) => ({ href: `/programs/${p.slug}`, label: p.name, description: p.duration })),
    cta: { href: "/contact?interest=programs", label: "Enquire about the next cohort" },
  },
  {
    href: "/enterprise",
    label: "For Enterprise",
    overviewLabel: "Corporate AI training overview",
    children: [
      { href: "/enterprise#tracks", label: "Role-based tracks", description: "Training for every department" },
      { href: "/enterprise#formats", label: "Training formats", description: "Briefings, cohorts, sprints and champions" },
      { href: "/enterprise#how-it-works", label: "How it works", description: "From assessment to lasting adoption" },
      { href: "/enterprise#measurement", label: "Impact & governance", description: "Measurement, security and data policies" },
    ],
    cta: { href: "/contact?interest=enterprise", label: "Request a proposal" },
  },
  {
    href: "/consulting",
    label: "Consulting",
    overviewLabel: "AI consulting overview",
    children: [
      { href: "/consulting#services", label: "Services", description: "Strategy, discovery, build and governance" },
      { href: "/consulting#engagement", label: "Engagement model", description: "Discovery sprint, pilot, then scale" },
      { href: "/consulting#what-we-build", label: "What we build", description: "Agents, voice AI and workflow automation" },
      {
        href: "https://induslabs.io",
        label: "IndusLabs voice AI",
        description: "Our sister company for voice agents",
        external: true,
      },
    ],
    cta: { href: "/contact?interest=consulting", label: "Book a discovery call" },
  },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export const tools = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Microsoft Copilot",
  "Perplexity",
  "NotebookLM",
  "n8n",
  "Make",
  "Zapier",
  "Cursor",
  "Lovable",
  "LangChain",
  "Vapi",
  "ElevenLabs",
  "Notion AI",
  "Python",
];

export const enquiryInterests = [
  { value: "enterprise", label: "Upskilling for my team or company" },
  { value: "programs", label: "An individual program" },
  { value: "consulting", label: "AI consulting or a build project" },
  { value: "partnership", label: "Partnership or speaking" },
];

export const teamSizes = ["Just me", "2–10", "11–50", "51–200", "201–1,000", "1,000+"];

export const homeFaqs = [
  {
    q: "Which AI course is right for working professionals?",
    a: "Most professionals start with the AI Generalist Certification: 4 weeks and 24 live hours of hands-on prompting, automation, AI agents and app building, with no coding required. Leaders usually choose AI for Leaders, and technical teams the AI Automation & Agents Bootcamp.",
  },
  {
    q: "Do you offer corporate AI training across India?",
    a: "Yes. Enterprise programs are delivered on site at your offices anywhere in India, live online, or in a hybrid format, with tracks tailored to each department.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. Most of our programs are designed for non-technical professionals. Where code helps, we use AI coding tools so you can build without a computer-science background. The Automation & Agents Bootcamp is the only program where basic scripting is useful.",
  },
  {
    q: "How is Indus AI Academy different from online AI courses?",
    a: "Everything is live and hands-on. You build real workflows in every session, with the tools teams actually use at work, and you finish with working projects instead of a watch history.",
  },
  {
    q: "Can you customize training for our company?",
    a: "Yes. Enterprise programs are designed around your roles, tools, data policies and real examples from your business. We start with a skills assessment and a review of the workflows that matter most.",
  },
  {
    q: "Is training online or in person?",
    a: "Both. Individual programs run as live online cohorts. Enterprise programs can be delivered on site, online or in a hybrid format.",
  },
  {
    q: "Who runs Indus AI Academy?",
    a: "Indus AI Academy is founded and led by Vivek Gupta, an IIT Delhi alumnus and PhD scholar, AI researcher and entrepreneur with 14 years in technology. Programs are delivered with practitioners who build AI systems at Indus AI.",
  },
  {
    q: "Do participants get a certificate?",
    a: "Yes. Certificates are issued by INDUS AI Private Limited, a DPIIT-recognized startup, and are awarded on completing the program and a reviewed capstone project, so they reflect real skill rather than attendance.",
  },
  {
    q: "How do you handle data privacy?",
    a: "We train teams to work inside your approved tools and policies. Sessions use sample or anonymized data unless you decide otherwise, and responsible-AI practice is part of every curriculum.",
  },
  {
    q: "How does a consulting engagement start?",
    a: "Usually with a two-to-three-week discovery sprint. We map opportunities, estimate impact and agree on a first pilot before any larger commitment.",
  },
];
