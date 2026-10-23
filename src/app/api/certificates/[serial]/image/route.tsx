import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";
import { logoPath } from "@/components/logo";
import { company, site } from "@/content/site";
import { formatIssueDate, getCertificate, verifyCertificateHash } from "@/lib/lms/certificates";

// A4 landscape.
const size = { width: 1600, height: 1131 };

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" | "italic" };
let fontsPromise: Promise<Font[]> | undefined;

/** Geist (the site's sans) and Instrument Serif italic (the name), fetched once per instance. */
function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Instrument+Serif:ital@1",
    ).then((r) => r.text());
    const faces = [...css.matchAll(/font-family: '([^']+)';\s*font-style: (\w+);\s*font-weight: (\d+);\s*src: url\(([^)]+)\)/g)];
    if (faces.length !== 3) throw new Error("unexpected Google Fonts CSS");
    return Promise.all(
      faces.map(async ([, name, style, weight, url]) => ({
        name,
        style: style as Font["style"],
        weight: Number(weight) as Font["weight"],
        data: await fetch(url).then((r) => r.arrayBuffer()),
      })),
    );
  })().catch((error) => {
    console.error("[certificate] fonts unavailable, using the default:", error);
    fontsPromise = undefined; // retry on the next request
    return [];
  });
  return fontsPromise;
}

/**
 * The certificate as a PNG. Public: the verification page shows it. Revoked (or
 * tampered) certificates still render, stamped, so the verification page and old
 * share previews show why rather than a broken image. `?download=1` makes it a download.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/certificates/[serial]/image">) {
  const { serial } = await ctx.params;
  const row = await getCertificate(serial);
  if (!row) return new Response("No certificate with that serial exists.", { status: 404 });
  const { certificate: cert, courseTitle } = row;
  const stamp = cert.revokedAt ? "Revoked" : verifyCertificateHash(cert) ? null : "Not verified";
  const fonts = await loadFonts();

  // Revalidated on every view (cheap: one query) and re-rendered only when what it shows
  // changes (revocation, a name being set, a redeploy), so a revocation shows at once.
  const etag = `"${createHash("sha1")
    .update(JSON.stringify([cert.holderName, courseTitle, cert.partnerName, cert.issuedAt, stamp, fonts.length, site.url, process.env.VERCEL_GIT_COMMIT_SHA]))
    .digest("base64url")}"`;
  const headers: Record<string, string> = { "Cache-Control": "public, no-cache", ETag: etag };
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="Indus-AI-Academy-certificate-${cert.serial}.png"`;
  }
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const name = cert.holderName.trim();
  const verifyUrl = `${site.url.replace(/^https?:\/\//, "")}/verify/${cert.serial}`;
  const muted = "#56655f";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f5f3ec", padding: 36, fontFamily: "Geist" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: 1,
            background: "#ffffff",
            border: "3px solid rgba(42,82,74,0.16)",
            borderRadius: 36,
            padding: "72px 110px 60px",
            color: "#0b1916",
          }}
        >
          <svg
            width="760"
            height="605"
            viewBox="0 0 206 164"
            fill="none"
            style={{ position: "absolute", left: (size.width - 72 - 760) / 2, top: 190 }}
          >
            <path d={logoPath} stroke="rgba(42,82,74,0.05)" strokeWidth="10.44" strokeLinejoin="round" />
          </svg>

          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#2a524a" }}>
            <svg width="50" height="40" viewBox="0 0 206 164" fill="none">
              <path d={logoPath} stroke="#2a524a" strokeWidth="11" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 32, fontWeight: 600 }}>{site.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 54, fontSize: 22, letterSpacing: "0.28em", color: muted }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f0a43a" }} />
            CERTIFICATE OF COMPLETION
          </div>

          <div style={{ marginTop: 70, fontSize: 30, color: muted }}>This certifies that</div>
          <div
            style={{
              marginTop: 10,
              fontFamily: "Instrument Serif",
              fontStyle: "italic",
              fontSize: name ? (name.length > 30 ? 92 : 124) : 60,
              lineHeight: 1.1,
              color: name ? "#0b1916" : muted,
              textAlign: "center",
            }}
          >
            {name || "Name to be confirmed"}
          </div>
          <div style={{ marginTop: 30, fontSize: 30, color: muted }}>has successfully completed</div>
          <div
            style={{
              marginTop: 14,
              maxWidth: 1200,
              fontSize: courseTitle.length > 50 ? 46 : 58,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              textAlign: "center",
            }}
          >
            {courseTitle}
          </div>
          {cert.partnerName && (
            <div style={{ marginTop: 22, fontSize: 26, color: muted }}>{`Delivered in partnership with ${cert.partnerName}`}</div>
          )}

          <div style={{ display: "flex", width: "100%", gap: 48, marginTop: "auto" }}>
            {[
              ["Issued on", formatIssueDate(cert.issuedAt)],
              ["Certificate no.", cert.serial],
              ["Issued by", company.legalName],
            ].map(([label, value], i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  alignItems: ["flex-start", "center", "flex-end"][i],
                  borderTop: "2px solid #dcd8cc",
                  paddingTop: 18,
                }}
              >
                <div style={{ fontSize: 20, color: muted }}>{label}</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 30, fontSize: 21, color: muted }}>{`Verify this certificate at ${verifyUrl}`}</div>

          {stamp && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  transform: "rotate(-14deg)",
                  border: "10px solid #b42318",
                  borderRadius: 24,
                  padding: "10px 56px",
                  color: "#b42318",
                  fontSize: stamp.length > 8 ? 110 : 150,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {stamp}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, headers, ...(fonts.length > 0 && { fonts }) },
  );
}
