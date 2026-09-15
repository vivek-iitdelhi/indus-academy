import { renderOgImage } from "@/lib/og";

export const alt = "Indus AI Academy blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Blog",
    title: "Practical guides to working with AI",
    subtitle: "AI upskilling · AI courses and careers · AI agents for business",
  });
}
