"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Asks the status route about lessons whose video is pending, which promotes any the
 * encoder has finished (it can't touch the database itself). Re-renders if one did.
 */
export function SyncPendingVideos({ lessonIds }: { lessonIds: string[] }) {
  const router = useRouter();
  const key = lessonIds.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void Promise.all(
      key.split(",").map((id) =>
        fetch(`/api/admin/lessons/${id}/video`)
          .then((res) => (res.ok ? (res.json() as Promise<{ ready: boolean }>) : null))
          .catch(() => null),
      ),
    ).then((statuses) => {
      if (!cancelled && statuses.some((s) => s?.ready)) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [key, router]);
  return null;
}
