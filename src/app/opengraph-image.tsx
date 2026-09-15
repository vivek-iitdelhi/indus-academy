import { ImageResponse } from "next/og";
import { logoPath } from "@/components/logo";

export const alt = "Indus AI Academy: AI training and consulting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b1916",
          color: "#f5f3ec",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="58" viewBox="0 0 206 164" fill="none">
            <path d={logoPath} stroke="#bfe0d3" strokeWidth="10.44" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 600 }}>Indus AI Academy</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Build an AI-fluent workforce.
          </div>
          <div style={{ fontSize: 30, color: "rgba(245,243,236,0.65)", marginTop: 28 }}>
            Certification programs · Enterprise upskilling · AI consulting
          </div>
        </div>
      </div>
    ),
    size,
  );
}
