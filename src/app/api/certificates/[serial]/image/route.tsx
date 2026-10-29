import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { logoPath } from "@/components/logo";
import { company, site } from "@/content/site";
import { BLS_LOGO, BLS_SIGNATURE } from "@/lib/certificate-bls-assets";
import { indicFont, latinEms, NAME_BOX, nameFontSize } from "@/lib/certificate-text";
import { formatIssueDate, getCertificate, verifyCertificateHash } from "@/lib/lms/certificates";

// A4 landscape.
const size = { width: 1600, height: 1131 };

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" | "italic" };
let fontsPromise: Promise<Font[]> | undefined;

/** Geist (the site's sans), Instrument Serif italic (the name) and Playfair Display italic (BLS's name), fetched once per instance. */
function loadFonts(): Promise<Font[]> {
  fontsPromise ??= (async () => {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Instrument+Serif:ital@1&family=Playfair+Display:ital@1",
    ).then((r) => r.text());
    const faces = [...css.matchAll(/font-family: '([^']+)';\s*font-style: (\w+);\s*font-weight: (\d+);\s*src: url\(([^)]+)\)/g)];
    if (faces.length !== 4) throw new Error("unexpected Google Fonts CSS");
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

const indicFontFiles = new Map<string, Promise<string | null>>();

/**
 * A Noto Serif family's TTF, fetched once per instance and only for names in its script.
 * Kept on disk because sharp (Pango) loads fonts from files.
 */
function loadIndicFont(family: string): Promise<string | null> {
  let file = indicFontFiles.get(family);
  if (!file) {
    file = (async () => {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}`).then((r) => r.text());
      const url = css.match(/src: url\(([^)]+)\)/)?.[1];
      if (!url) throw new Error(`unexpected Google Fonts CSS for ${family}`);
      const dir = join(tmpdir(), "certificate-fonts");
      await mkdir(dir, { recursive: true });
      const path = join(dir, `${family}.ttf`);
      await writeFile(path, Buffer.from(await (await fetch(url)).arrayBuffer()));
      return path;
    })().catch((error) => {
      console.error(`[certificate] ${family} unavailable:`, error);
      indicFontFiles.delete(family); // retry on the next request
      return null;
    });
    indicFontFiles.set(family, file);
  }
  return file;
}

const escapeMarkup = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/**
 * An Indic name as a PNG set by Pango, which shapes conjuncts, matras and reph (Satori
 * draws them unjoined and out of order). Sized by the same rule as Latin names. Null if
 * sharp fails, so Satori sets it after all. In local dev on macOS Pango ignores `fontfile`
 * and uses a system font; production (Linux) uses the Noto file.
 */
async function renderIndicName(name: string, family: string, fontfile: string, color: string) {
  const set = (fontSize: number, width?: number) =>
    sharp({
      text: {
        text: `<span foreground="${color}">${escapeMarkup(name)}</span>`,
        font: `${family} ${fontSize}`, // points, which are px at 72 dpi
        fontfile,
        dpi: 72,
        rgba: true,
        align: "centre",
        wrap: "word-char",
        width,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
  try {
    const probe = await set(100);
    const { fontSize, lines } = nameFontSize(probe.info.width / 100);
    const { data, info } = await set(fontSize, lines === 2 ? NAME_BOX : undefined);
    return { src: `data:image/png;base64,${data.toString("base64")}`, width: info.width, height: info.height };
  } catch (error) {
    console.error("[certificate] could not set the name with Pango:", error);
    return null;
  }
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
  const { certificate: cert, courseTitle, bls } = row;
  const stamp = cert.revokedAt ? "Revoked" : verifyCertificateHash(cert) ? null : "Not verified";
  const name = cert.holderName.trim();
  const family = indicFont(name);
  const [fonts, indicFontFile] = await Promise.all([loadFonts(), family && loadIndicFont(family)]);

  // Revalidated on every view (cheap: one query) and re-rendered only when what it shows
  // changes (revocation, a name being set, a redeploy), so a revocation shows at once.
  const etag = `"${createHash("sha1")
    .update(JSON.stringify([bls, cert.holderName, courseTitle, cert.partnerName, cert.issuedAt, stamp, fonts.length, Boolean(indicFontFile), site.url, process.env.VERCEL_GIT_COMMIT_SHA, process.env.NEXT_DEPLOYMENT_ID]))
    .digest("base64url")}"`;
  const headers: Record<string, string> = { "Cache-Control": "public, no-cache", ETag: etag };
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="Indus-AI-Academy-certificate-${cert.serial}.png"`;
  }
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const verifyUrl = `${site.url.replace(/^https?:\/\//, "")}/verify/${cert.serial}`;
  const muted = "#56655f";
  const indicName = family && indicFontFile ? await renderIndicName(name, family, indicFontFile, "#0b1916") : null;
  const stampBox = stamp && <Stamp text={stamp} />;
  if (bls) {
    return new ImageResponse(
      <BlsCertificate
        name={name}
        indicName={indicName}
        courseTitle={courseTitle}
        footer={`Certificate no. ${cert.serial} · Issued on ${formatIssueDate(cert.issuedAt)} · Verify at ${verifyUrl}`}
        stamp={stampBox}
      />,
      { ...size, headers, ...(fonts.length > 0 && { fonts }) },
    );
  }

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
          {indicName ? (
            // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not a page
            <img src={indicName.src} width={indicName.width} height={indicName.height} alt="" style={{ marginTop: 28, marginBottom: 6 }} />
          ) : (
            <div
              style={{
                marginTop: 10,
                maxWidth: NAME_BOX,
                fontFamily: "Instrument Serif",
                fontStyle: "italic",
                fontSize: name ? nameFontSize(latinEms(name)).fontSize : 60,
                lineHeight: 1.1,
                color: name ? "#0b1916" : muted,
                textAlign: "center",
                textWrap: "balance",
                wordBreak: "break-word",
              }}
            >
              {name || "Name to be confirmed"}
            </div>
          )}
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
            <div style={{ marginTop: 22, fontSize: 26, color: muted, textAlign: "center", maxWidth: 1200 }}>{`Delivered in partnership with ${cert.partnerName}`}</div>
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

          {stampBox}
        </div>
      </div>
    ),
    { ...size, headers, ...(fonts.length > 0 && { fonts }) },
  );
}

function Stamp({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: "rotate(-14deg)",
          border: "10px solid #b42318",
          borderRadius: 24,
          padding: "10px 56px",
          color: "#b42318",
          fontSize: text.length > 8 ? 110 : 150,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** BLS E-Services × Indus AI certificate of participation, after the Canva design (canva.link/uoi1b3xsdgdigke). */
function BlsCertificate({
  name,
  indicName,
  courseTitle,
  footer,
  stamp,
}: {
  name: string;
  indicName: { src: string; width: number; height: number } | null;
  courseTitle: string;
  footer: string;
  stamp: React.ReactNode;
}) {
  const ink = "#2b2b2b";
  const muted = "#7a7a7a";
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", background: "#ffffff", padding: "70px 150px 40px", color: ink, fontFamily: "Geist" }}>
      <svg width="760" height="605" viewBox="0 0 206 164" fill="none" style={{ position: "absolute", left: (size.width - 760) / 2, top: 230 }}>
        <path d={logoPath} stroke="rgba(70,95,130,0.09)" strokeWidth="10.44" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not a page */}
        <img src={BLS_LOGO} width={206} height={142} alt="" />
        <div style={{ width: 2, height: 100, background: ink }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#2a524a" }}>
          <svg width="120" height="96" viewBox="0 0 206 164" fill="none">
            <path d={logoPath} stroke="#2a524a" strokeWidth="13" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: "-0.02em" }}>Indus AI</div>
        </div>
      </div>
      <div style={{ marginTop: 92, fontSize: 38, fontWeight: 600, letterSpacing: "0.32em", color: "#3a3a3a" }}>CERTIFICATE OF PARTICIPATION</div>
      <div style={{ marginTop: 64, fontSize: 32, color: muted }}>This certifies that</div>
      {indicName ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not a page
        <img src={indicName.src} width={indicName.width} height={indicName.height} alt="" style={{ marginTop: 26 }} />
      ) : (
        <div
          style={{
            marginTop: 8,
            maxWidth: NAME_BOX,
            fontFamily: "Playfair Display",
            fontStyle: "italic",
            fontSize: name ? nameFontSize(latinEms(name) * 1.2).fontSize : 72,
            lineHeight: 1.15,
            color: name ? "#1f1f1f" : muted,
            textAlign: "center",
            textWrap: "balance",
            wordBreak: "break-word",
          }}
        >
          {name || "Name to be confirmed"}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 1250, marginTop: 34, fontSize: 34, textAlign: "center" }}>
        <span>has completed the&nbsp;</span>
        <span style={{ fontWeight: 600 }}>{courseTitle}</span>
        <span>.</span>
      </div>

      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", marginTop: "auto" }}>
        {[
          { title: "Vivek Gupta - IIT Delhi Alumnus", role: "Founder · Indus AI Academy", signature: null },
          { title: "BLS E-Services Limited", role: "Issuing company", signature: BLS_SIGNATURE },
        ].map((s, i) => (
          <div key={s.title} style={{ display: "flex", flexDirection: "column", alignItems: i ? "center" : "flex-start", width: 470 }}>
            <div style={{ display: "flex", height: 110, alignItems: "flex-end", justifyContent: "center", width: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not a page */}
              {s.signature && <img src={s.signature} width={292} height={108} alt="" />}
            </div>
            <div style={{ width: "100%", height: 2, background: ink }} />
            <div style={{ marginTop: 22, fontSize: 30, fontWeight: 600 }}>{s.title}</div>
            <div style={{ marginTop: 8, fontSize: 24, color: muted }}>{s.role}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 34, fontSize: 18, color: muted }}>{footer}</div>
      {stamp}
    </div>
  );
}
