import { ImageResponse } from "next/og";
import { logoPath } from "@/components/logo";

// Shared 1200×630 social card used by every opengraph-image route.
export function renderOgImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="58" viewBox="0 0 206 164" fill="none">
              <path d={logoPath} stroke="#bfe0d3" strokeWidth="10.44" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 34, fontWeight: 600 }}>Indus AI Academy</div>
          </div>
          <div style={{ fontSize: 24, color: "#f0a43a", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {eyebrow}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ fontSize: 30, color: "rgba(245,243,236,0.7)", marginTop: 28, maxWidth: 1000 }}>{subtitle}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
