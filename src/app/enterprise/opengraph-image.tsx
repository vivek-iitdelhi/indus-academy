import { renderOgImage } from "@/lib/og";

export const alt = "Corporate AI training and employee upskilling at Indus AI Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Enterprise",
    title: "Corporate AI training for every team",
    subtitle: "Role-based tracks · On site across India, online or hybrid · Measured before and after",
  });
}
