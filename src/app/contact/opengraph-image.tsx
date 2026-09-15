import { renderOgImage } from "@/lib/og";

export const alt = "Contact Indus AI Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Contact",
    title: "Let's build your AI advantage.",
    subtitle: "Corporate AI training · AI courses · AI consulting · hello@indusai.academy",
  });
}
