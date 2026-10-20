import { renderOgImage } from "@/lib/og";
import { getCatalogCourse, priceLabel } from "../catalog";

export const alt = "Indus AI Academy online course";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const found = await getCatalogCourse((await params).slug);
  return renderOgImage({
    eyebrow: "Online course",
    title: found?.course.title ?? "Self-paced online AI courses",
    subtitle: found ? `${found.course.subtitle ?? "Self-paced"} · ${priceLabel(found.course.pricePaise)}` : "Learn at your own pace",
  });
}
