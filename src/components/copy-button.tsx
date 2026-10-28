"use client";

import { useState } from "react";

/** Copies `text` to the clipboard; the label says "Copied" for a moment. */
export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      title={text}
      className={className}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
