import { programs } from "@/content/programs";
import { renderOgImage } from "@/lib/og";

export const alt = "Indus AI Academy program";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = programs.find((p) => p.slug === slug);
  return renderOgImage({
    eyebrow: "Program",
    title: program?.name ?? "AI courses & certification",
    subtitle: program ? `${program.duration} · ${program.tagline}` : "Live, hands-on AI programs",
  });
}
