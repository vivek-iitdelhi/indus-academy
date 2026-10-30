#!/usr/bin/env bash
# What partners are sending the API, from the [partner-api] log lines (kept 14 days). Read-only.
#   scripts/partner-watch.sh 60            # the last 60 minutes, then stop
#   scripts/partner-watch.sh 60 --follow   # then keep printing new requests, one line each
set -uo pipefail
export AWS_PROFILE=${AWS_PROFILE:-sociafy} AWS_REGION=${AWS_REGION:-ap-south-1}
since=$(( ( $(date +%s) - ${1:-60} * 60 ) * 1000 ))
seen=$(mktemp); trap 'rm -f "$seen"' EXIT
while true; do
  now=$(( $(date +%s) * 1000 ))
  out=$(aws logs filter-log-events --log-group-name /ecs/indus-academy --start-time "$since" \
    --filter-pattern '"[partner-api]"' --output json 2>&1) || { echo "WATCH ERROR: ${out:0:200}"; [[ ${2:-} == --follow ]] || exit 1; sleep 60; continue; }
  OUT="$out" SEEN="$seen" node -e '
    const fs = require("fs"), seen = new Set(fs.readFileSync(process.env.SEEN, "utf8").split("\n"));
    for (const e of JSON.parse(process.env.OUT).events ?? []) {
      if (seen.has(e.eventId)) continue;
      fs.appendFileSync(process.env.SEEN, e.eventId + "\n");
      const r = JSON.parse(e.message.slice(e.message.indexOf("{")));
      const at = new Date(e.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
      console.log(`${at} ${r.partner ?? r.key}${r.test ? " (test key)" : ""} ${r.endpoint} -> ${r.status} ${r.ms}ms${r.error ? ` ${r.error}: ${r.message ?? ""}` : ""}`);
    }'
  [[ ${2:-} == --follow ]] || exit 0
  since=$(( now - 120000 )) # overlap: log lines can arrive late
  sleep 30
done
