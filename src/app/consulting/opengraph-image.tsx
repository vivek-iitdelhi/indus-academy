import { renderOgImage } from "@/lib/og";

export const alt = "AI consulting at Indus AI Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Consulting",
    title: "From AI ambition to systems in production",
    subtitle: "AI strategy · Agents, voice AI & automation · Governance and enablement",
  });
}
