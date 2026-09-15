# Indus AI Academy

Marketing website for Indus AI Academy: AI certification programs for individuals, role-based AI upskilling for enterprises, and AI consulting.

Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript and Tailwind CSS 4.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## Environment variables

| Variable               | Purpose                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Production URL, used for metadata, `sitemap.xml` and `robots.txt`.                          |
| `ENQUIRY_WEBHOOK_URL`  | Contact-form enquiries are POSTed here as JSON (for example an n8n or CRM webhook).         |

Without `ENQUIRY_WEBHOOK_URL`, enquiries are logged to the server console in development. In production, the form shows an error that points visitors to the contact email instead of silently dropping them.

## Pages

| Route         | Content                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `/`           | Hero, services, principles, flagship curriculum, tracks, process, FAQ     |
| `/programs`   | All programs, with the full AI Generalist curriculum                      |
| `/enterprise` | Role-based tracks, formats, rollout process, measurement and governance   |
| `/consulting` | Offerings, engagement model and example builds                            |
| `/contact`    | Enquiry form (`?interest=enterprise\|programs\|consulting\|partnership` preselects) |

## Editing content

Copy lives in `src/content/`, separate from layout code:

- `site.ts`: name, contact email, navigation, tools strip, enquiry options, home FAQ
- `programs.ts`: programs, facts, outcomes and the flagship curriculum
- `enterprise.ts`: role tracks, formats, rollout steps, measurement
- `consulting.ts`: offerings, engagement phases, example builds

Design tokens (colors, fonts, animations) are in `src/app/globals.css`.

## Before launch

- [x] Confirm founder profile, issuing company, credentials and contact email
- [ ] Set `ENQUIRY_WEBHOOK_URL` in the hosting environment
- [ ] Point the indusai.academy domain at the deployment
- [ ] Review program durations, formats and outcomes, and add pricing if it should be public
- [ ] Add real testimonials, client logos and faculty profiles once approved for use
