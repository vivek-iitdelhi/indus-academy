import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { certificateHash, formatIssueDate, formatSerial, linkedInAddUrl, verifyCertificateHash } from "./certificates.ts";

test("serials are IAA-<year>-<at least 4 digits>", () => {
  assert.equal(formatSerial(2026, 1), "IAA-2026-0001");
  assert.equal(formatSerial(2026, 42), "IAA-2026-0042");
  assert.equal(formatSerial(2027, 12345), "IAA-2027-12345");
});

const cert = {
  serial: "IAA-2026-0001",
  userId: "user_1",
  courseId: "6f1c1d1e-0000-4000-8000-000000000001",
  issuedAt: new Date("2026-10-20T10:00:00.123Z"),
};

test("hash is HMAC-SHA256 over serial|user|course|issued ISO", () => {
  const expected = createHmac("sha256", "s3cret")
    .update("IAA-2026-0001|user_1|6f1c1d1e-0000-4000-8000-000000000001|2026-10-20T10:00:00.123Z")
    .digest("hex");
  assert.equal(certificateHash(cert, "s3cret"), expected);
});

test("verification catches any edited field or a different secret", () => {
  const hash = certificateHash(cert, "s3cret");
  assert.equal(verifyCertificateHash({ ...cert, hash }, "s3cret"), true);
  assert.equal(verifyCertificateHash({ ...cert, userId: "user_2", hash }, "s3cret"), false);
  assert.equal(verifyCertificateHash({ ...cert, issuedAt: new Date("2026-10-20T10:00:01Z"), hash }, "s3cret"), false);
  assert.equal(verifyCertificateHash({ ...cert, hash }, "other"), false);
  assert.equal(verifyCertificateHash({ ...cert, hash: "short" }, "s3cret"), false);
});

test("issue dates and LinkedIn's issue month are India's calendar date", () => {
  const lateUtc = new Date("2026-12-31T20:00:00Z"); // 1 January 2027, 01:30 IST
  assert.equal(formatIssueDate(lateUtc), "1 January 2027");
  const url = new URL(
    linkedInAddUrl({
      courseTitle: "AI at Work: Essentials",
      serial: "IAA-2027-0001",
      issuedAt: lateUtc,
      certUrl: "https://indusai.academy/verify/IAA-2027-0001",
      organizationName: "INDUS AI Private Limited",
    }),
  );
  assert.equal(url.origin + url.pathname, "https://www.linkedin.com/profile/add");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    startTask: "CERTIFICATION_NAME",
    name: "AI at Work: Essentials",
    organizationName: "INDUS AI Private Limited",
    issueYear: "2027",
    issueMonth: "1",
    certUrl: "https://indusai.academy/verify/IAA-2027-0001",
    certId: "IAA-2027-0001",
  });
  assert.ok(!url.search.includes("+"), "spaces are %20, not +");
});

test("LinkedIn uses the organisation id instead of the name when set", () => {
  const url = new URL(
    linkedInAddUrl({ courseTitle: "C", serial: "S", issuedAt: new Date(), certUrl: "u", organizationId: "123", organizationName: "N" }),
  );
  assert.equal(url.searchParams.get("organizationId"), "123");
  assert.equal(url.searchParams.has("organizationName"), false);
});
