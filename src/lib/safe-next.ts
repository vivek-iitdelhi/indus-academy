/** Only same-site paths survive as a post-sign-in destination; anything else is `fallback`. */
export function safeNextPath(value: unknown, fallback = "/learn"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // Resolve it as a browser would (which strips tabs and newlines, so "/\t/evil.com" is
  // "//evil.com"), and accept only what stays on our origin.
  const base = "http://same.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base && !/[\u0000-\u001f\u007f\\]/.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
