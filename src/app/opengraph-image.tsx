import { renderOgImage } from "@/lib/og";

export const alt = "Indus AI Academy: AI courses, corporate AI training and AI consulting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "AI Academy",
    title: "Build an AI-fluent workforce.",
    subtitle: "AI courses · Corporate AI training · AI consulting · Founded by an IIT Delhi PhD",
  });
}
