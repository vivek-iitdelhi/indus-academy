/** Only same-site paths survive as a post-sign-in destination; anything else is `fallback`. */
export function safeNextPath(value: unknown, fallback = "/learn"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : fallback;
}
