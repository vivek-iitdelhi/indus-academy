import { renderOgImage } from "@/lib/og";

export const alt = "Self-paced online AI courses at Indus AI Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Courses",
    title: "Self-paced online AI courses",
    subtitle: "Short, practical video lessons with quizzes. Lifetime access and a verifiable certificate.",
  });
}
