/**
 * Exponential backoff with "equal jitter": attempt 0 waits base/2..base, each attempt doubles
 * that, up to cap/2..cap. The jitter spreads a crowd of retries over time. Shared by the server's
 * queue and the browser's retries, so no imports here.
 */
export const backoffMs = (attempt: number, { base, cap }: { base: number; cap: number }, rand = Math.random) => {
  const ceiling = Math.min(cap, base * 2 ** attempt);
  return ceiling / 2 + (rand() * ceiling) / 2;
};
