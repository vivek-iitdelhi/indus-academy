import { renderOgImage } from "@/lib/og";

export const alt = "AI courses and certification programs at Indus AI Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Programs",
    title: "AI courses & certification programs",
    subtitle: "Live, hands-on and taught by practitioners. Certificates issued by INDUS AI Private Limited.",
  });
}
