import { ImageResponse } from "next/og";
import { logoPath } from "@/components/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1916",
        }}
      >
        <svg width="124" height="99" viewBox="0 0 206 164" fill="none">
          <path d={logoPath} stroke="#bfe0d3" strokeWidth="12" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
