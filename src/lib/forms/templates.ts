import { defaultSettings, type FormItem, type FormSettings } from "./types.ts";

// Starting points for "New form" in /admin/forms. Relative imports: node tests load this file.

export type FormTemplate = { title: string; description: string; items: FormItem[]; settings: FormSettings };

const id = () => crypto.randomUUID();
const opts = (...labels: string[]) => labels.map((label) => ({ label }));

/** Google's blank form: one untitled multiple-choice question. */
const blank = (): FormTemplate => ({
  title: "Untitled form",
  description: "",
  items: [{ id: id(), type: "choice", title: "Untitled question", options: opts("Option 1") }],
  settings: defaultSettings,
});

const collegeEnrollment = (): FormTemplate => ({
  title: "College student enrollment",
  description:
    "Enrol for Indus AI Academy's programs for college students. It takes about 5 minutes. Keep your college ID card ready (photo or PDF).",
  items: [
    { id: id(), type: "short", title: "Full name", description: "As it appears on your college ID card.", required: true },
    {
      id: id(),
      type: "short",
      title: "Email address",
      required: true,
      validation: { kind: "text", op: "email", message: "Enter a valid email address." },
    },
    {
      id: id(),
      type: "short",
      title: "Mobile number",
      description: "10 digits, without +91 or a leading 0.",
      required: true,
      validation: { kind: "regex", op: "matches", pattern: "^[6-9][0-9]{9}$", message: "Enter a 10-digit Indian mobile number." },
    },
    { id: id(), type: "short", title: "College name", required: true },
    {
      id: id(),
      type: "dropdown",
      title: "Course / branch",
      required: true,
      options: opts(
        "B.Tech / B.E. – Computer Science",
        "B.Tech / B.E. – Information Technology",
        "B.Tech / B.E. – Electronics & Communication",
        "B.Tech / B.E. – Electrical",
        "B.Tech / B.E. – Mechanical",
        "B.Tech / B.E. – Civil",
        "B.Tech / B.E. – AI & Data Science",
        "BCA",
        "MCA",
        "B.Sc",
        "M.Sc",
        "B.Com",
        "BBA",
        "MBA",
        "BA",
        "Other",
      ),
    },
    {
      id: id(),
      type: "choice",
      title: "Year of study",
      required: true,
      options: opts("1st year", "2nd year", "3rd year", "4th year"),
      other: true,
    },
    { id: id(), type: "short", title: "Roll number / enrolment number", required: true },
    { id: id(), type: "date", title: "Date of birth", required: true, includeYear: true, includeTime: false },
    { id: id(), type: "short", title: "City", required: true },
    {
      id: id(),
      type: "section",
      title: "Program preferences",
      description: "Tell us what you'd like to learn. You can choose more than one program.",
    },
    {
      id: id(),
      type: "checkboxes",
      title: "Program interested in",
      required: true,
      options: opts(
        "AI fundamentals & prompt engineering",
        "ChatGPT & generative AI for productivity",
        "Python for AI & machine learning",
        "Data analytics with AI",
        "Building AI agents & automations",
        "Internship / live project",
      ),
    },
    {
      id: id(),
      type: "file",
      title: "College ID card",
      description: "A clear photo or scan of the front of your college ID card (image or PDF, up to 10 MB).",
      required: true,
      maxFiles: 1,
      maxSizeMb: 10,
      accept: ["pdf", "image"],
    },
    {
      id: id(),
      type: "dropdown",
      title: "How did you hear about us?",
      options: opts("College / Training & Placement cell", "Friend or classmate", "Faculty", "Instagram", "LinkedIn", "YouTube", "WhatsApp group", "Google search", "Other"),
    },
    {
      id: id(),
      type: "checkboxes",
      title: "Consent",
      required: true,
      options: opts("I confirm the details above are correct and agree to be contacted by Indus AI Academy about my enrolment."),
    },
  ],
  settings: { ...defaultSettings, confirmation: "Thanks for enrolling! Our team will contact you within 2 working days." },
});

export const formTemplates = {
  blank: { label: "Blank form", build: blank },
  "college-enrollment": { label: "College student enrollment", build: collegeEnrollment },
} as const;

export type FormTemplateId = keyof typeof formTemplates;
