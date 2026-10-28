# Indus AI Academy distributor API

For partner platforms licensed to deliver our courses. You get each licensed course's
structure, its quizzes (with answers) and a protected video player to embed, and you run
progress and grading on your own platform. You tell us about your learners, what they
enrol in and what they complete, and we issue our certificate for them, co-branded with your name, when
it is released under the terms agreed with you (for example, once the batch is paid).

Base URL: `https://indusai.academy/api/v2` for new integrations. `https://indusai.academy/api/v1`
keeps working unchanged; see [Versions](#versions) for the differences.

## Authentication

Every request carries your API key as a bearer token:

```
Authorization: Bearer iaa_live_…
```

- We show the key once, when it is created or rotated. We store only a hash and cannot
  recover it; if it is lost, ask us to rotate it.
- **The key is a server-side secret.** Call the API from your backend only; never ship
  the key to a browser or mobile app. The API sends no CORS headers, so browser calls fail
  by design.
- You can hold **two live keys at once**, so a key can be changed with no downtime: we issue
  a second key, you deploy it, and once your traffic has moved we revoke the old one. A
  revoked key stops working immediately.
- **Test keys** (`iaa_test_…`) work exactly like live keys, on the same courses and endpoints,
  but in a sandbox of your own: learners, enrolments and batches you create with a test key
  are kept apart from your live ones and are never billed, and certificates issued in test
  mode are marked TEST and revoked as they are issued, so they never verify as valid. Webhooks
  for test data come to your usual URL with `"test": true` in `data`. Ask us for one to build and test your integration.
  Live keys start `iaa_live_…`.

All responses are JSON with `Cache-Control: no-store`. You see only courses that are
licensed to you and currently published; anything else answers 404, whether or not it
exists.

## Rate limits

Each key may make **120 requests a minute** unless we've agreed another limit with you. Every
response (after authentication) says where you stand:

```
ratelimit-policy: 120;w=60
ratelimit: limit=120, remaining=87, reset=23
```

`remaining` is what's left in the current one-minute window, and `reset` is the number of
seconds until the window starts over. Over the limit, you get `429`:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 23

{ "error": { "code": "rate_limited", "message": "Over the limit of 120 requests a minute. Retry in 23 s.", "retry_after": 23 } }
```

Wait `retry_after` seconds (the same value as `Retry-After`), then carry on. For large imports,
use the bulk endpoints (up to 500 items per request) rather than one request per learner.

A much higher ceiling also protects the service from floods of requests. It answers with
the same `429 rate_limited` body and `Retry-After: 60`, but without the `ratelimit` headers.

## Retrying safely (`Idempotency-Key`)

Any `POST` or `PUT` can carry an `Idempotency-Key` header: a unique value of your choosing,
up to 255 characters (a UUID is ideal). Send the same key again when you retry the same
request, for example after a timeout, and it runs only once:

- **A repeat of a finished request** gets the original response again (same status, same
  body), with the header `idempotent-replayed: true`. Nothing runs a second time.
- **A repeat while the first is still running** gets `409 request_in_progress`. Retry a few
  seconds later.
- **The same key with a different request** (another body, path or method) gets
  `409 idempotency_conflict`. Use a new key for every new request.

We keep keys for 24 hours. A request that failed with a `5xx` is not kept, so retrying it
with the same key runs it again. Requests without the header behave as they always have.

```sh
curl -X POST https://indusai.academy/api/v1/learners/u_123/enrolments \
  -H "Authorization: Bearer $INDUS_KEY" \
  -H "Idempotency-Key: 6f1c2f9e-3b1d-4c55-9a51-2d0e8f7b1a10" \
  -H "Content-Type: application/json" \
  -d '{"course":"ai-practitioner","batch":"Jan 2027"}'
```

## Versions

There are two versions, side by side, with the same endpoints and response shapes. **v2** is
for new integrations: it enforces the enrolment and billing rules that v1 can't, without
breaking v1 clients. **v1** keeps behaving exactly as before; everything new below that isn't
a v2 rule works in v1 too.

What v2 does differently:

| | v1 | v2 |
| --- | --- | --- |
| Video playback | `learner` optional, never blocks | `learner` required; the learner needs an active, unexpired enrolment in the course (`403 not_enrolled`) |
| Completions | enrol the learner if needed; `batch` required | the learner must be enrolled (`409 not_enrolled`); `batch` optional, defaults to the enrolment's, and may not differ from it (`409 batch_mismatch`) |
| Batches | names are case-sensitive; paid batches still take learners | names match in any case (`bls-nov` is `BLS-Nov`); a paid batch is closed: nobody joins or leaves it (`409 batch_closed`) |
| Quiz answers in `GET /courses/{slug}` | always included | only with `?include=answers`; otherwise grade with `POST /lessons/{id}/grade` |
| Timestamps you send (`completed_at`, …) | anything a date parser accepts | ISO 8601 with a zone, like `2026-10-23T06:00:00Z` or `…+05:30` |

The examples below use `/api/v1`; swap in `/api/v2` and they work the same, under the rules above.

## Endpoints

### `GET /courses`

Your licensed courses.

```sh
curl -H "Authorization: Bearer $IAA_KEY" https://indusai.academy/api/v1/courses
```

```json
{
  "courses": [
    {
      "id": "d3bfce76-01fd-4e97-ba5f-9b338ea42d30",
      "slug": "ai-at-work-essentials",
      "title": "AI at Work: Essentials",
      "subtitle": "Use AI assistants confidently in your everyday work",
      "description": "Short videos and quick checks…\n\n- Bite-sized 4–5 minute lessons",
      "format": "interactive",
      "sequential": true,
      "certificate_enabled": true,
      "language": "en",
      "cover_image_url": "https://…/cover.jpg",
      "price_paise": 149900,
      "lesson_count": 6,
      "total_duration_seconds": 1112,
      "updated_at": "2026-10-20T06:20:20.865Z"
    }
  ]
}
```

- `description` is Markdown. `price_paise` is our list price (GST-inclusive), for
  information only.
- `format`: `interactive` (short videos with quizzes) or `standard` (long recordings).
- `sequential: true` means a learner should finish each lesson before the next unlocks;
  enforcing that on your platform is up to you.
- `language`: the ISO 639-1 code of the teaching language (`en`, `hi`, …). `cover_image_url`
  may be `null`.
- Use `updated_at` to decide when to re-sync a course. It changes whenever anything in the
  course changes: its details, a lesson, a quiz question or a video. Each lesson also has its
  own `updated_at`.

### `GET /courses/{slug}`

One course with its chapters and lessons in order. Quiz lessons include the questions
and correct answers so you can run and grade them yourself.

```sh
curl -H "Authorization: Bearer $IAA_KEY" https://indusai.academy/api/v1/courses/ai-at-work-essentials
```

```json
{
  "course": {
    "id": "d3bfce76-…",
    "slug": "ai-at-work-essentials",
    "title": "AI at Work: Essentials",
    "…": "same fields as in /courses",
    "chapters": [
      {
        "id": "…",
        "title": "Getting started with AI assistants",
        "position": 1,
        "lessons": [
          {
            "id": "7f6a95e5-028b-47c7-9bca-a74d5ed4531e",
            "slug": "what-ai-can-do",
            "title": "What AI assistants can (and can't) do",
            "kind": "video",
            "position": 1,
            "summary": "A plain-English tour of what today's assistants are good at.",
            "duration_seconds": 272,
            "is_preview": true,
            "has_video": true
          },
          {
            "id": "4675d52f-f9c5-4c09-89c9-2dd97fddf39c",
            "slug": "check-the-basics",
            "title": "Check: the basics",
            "kind": "quiz",
            "position": 2,
            "summary": "Three quick questions on what you just watched.",
            "duration_seconds": 0,
            "is_preview": false,
            "has_video": false,
            "quiz": {
              "pass_percent": 70,
              "questions": [
                {
                  "id": "3077e7ff-…",
                  "position": 1,
                  "prompt": "Which task is an AI assistant best suited to?",
                  "options": ["Guaranteeing facts are correct", "Drafting a first version of an email", "Replacing your judgement", "Storing passwords"],
                  "option_ids": ["5f1c0a9b2e", "a7d3e41c08", "0c9e77b1d4", "e2b85f6a19"],
                  "correct": [1],
                  "multi": false,
                  "explanation": "Assistants are strong at first drafts; you still check the facts."
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

- Lesson `position` is the order across the whole course; chapter `position` orders chapters.
- `correct` holds zero-based indices into `options`. `multi: true` (more than one correct
  index) means select all that apply; grade an answer as correct only when the chosen set
  equals `correct` exactly. A learner passes with a score of at least `pass_percent`.
- Keep the answers on your server; do not send `correct` to learners' browsers.
- `option_ids` are stable ids for the options, one per option. An id stays the same when options
  are reordered and changes when an option's text changes, so you can tell an edited question
  from a reordered one.
- In v2, `correct` and `explanation` are left out unless you ask with `?include=answers`.

### `POST /lessons/{lessonId}/grade`

Grades a quiz attempt on our side, so the answers never have to leave our servers. Nothing is
stored.

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"answers":[[1],[0,2],[3]]}' \
  https://indusai.academy/api/v1/lessons/4675d52f-f9c5-4c09-89c9-2dd97fddf39c/grade
```

```json
{ "score_percent": 67, "passed": false, "pass_percent": 70, "questions": [ { "id": "3077e7ff-…", "correct": true }, { "id": "…", "correct": false }, { "id": "…", "correct": true } ] }
```

- `answers[i]` lists the zero-based option indices the learner chose for question `i`, in
  question `position` order. Answers `409 not_a_quiz` for other lessons.

### `GET /lessons/{lessonId}/playback?ttl=<seconds>&learner=<external_id>`

A player for one video lesson, to embed on your page. Request it when a learner starts
watching.

```sh
curl -H "Authorization: Bearer $IAA_KEY" \
  "https://indusai.academy/api/v1/lessons/7f6a95e5-028b-47c7-9bca-a74d5ed4531e/playback?ttl=7200"
```

```json
{
  "embed_url": "https://indusai.academy/embed/9b1c…?t=1792504327.Kz8M…",
  "thumbnail": "https://…/thumb.jpg?X-Amz-Signature=…",
  "expires_at": "2026-10-20T08:26:01.000Z"
}
```

Show it in an iframe:

```html
<iframe src="EMBED_URL" style="width:100%;aspect-ratio:16/9;border:0"
        allow="autoplay; fullscreen" allowfullscreen></iframe>
```

- **Protected video.** Our videos are encrypted and play only inside this player, which
  handles quality switching on every modern browser (iPhone: iOS 17.1 or later). There is
  no downloadable file or playlist for you to host or cache. (Until 23 Oct 2026 this
  endpoint returned an `hls` URL; it was replaced by `embed_url`.)
- **Slow connections.** Videos also have a low-bandwidth quality (144p, about 150 kbps) for
  learners on 2G or weak 3G; we are adding it to older videos. The player moves to it on its own when the connection
  can't keep up and moves back up when it recovers. You don't need to configure anything.
- `ttl`: how long the player link stays valid, in seconds. Default 21600 (6 h), minimum
  300 (5 min), maximum 86400 (24 h).
- **Expiry.** Playback that is still running at `expires_at` stops, and the player sends an
  `expired` event (below). Pick a `ttl` longer than the viewing session (lesson length plus
  pauses), and fetch a fresh `embed_url` for each session rather than caching it. The link
  lets whoever has it watch that one video until it expires: put it only on the page of the
  learner who is watching.
- Use `thumbnail` as a placeholder image before the player loads.
- `learner`: the external id of the learner who will watch. We record the play against their
  enrolment, so you and we can see who watched. Required in v2, where the learner needs an
  active, unexpired enrolment in the course (otherwise `403 not_enrolled`); optional in v1,
  where it never blocks playback.
- Learners keep what they enrolled in: with `learner`, a lesson still plays after its course
  is unpublished or stops being licensed to you, for as long as their enrolment is active.

#### Player options

Append any of these to `embed_url` (it already has a `?`, so add each with `&`). All are
optional. A value we can't use is ignored, never an error, so a link without them plays as
it always has.

| Parameter          | Meaning                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lang=hi`          | The player's messages in Hindi. `en` (English) is the default.                                                                                                                                                           |
| `start=<seconds>`  | Start playing from this point, e.g. the `seconds` of the learner's last `progress` event, so they resume where they left off. Whole seconds; a start past the end plays from the beginning.                              |
| `max_height=<n>`   | Never load a quality above `n`p, to save the learner's data. It compares the shorter side of the picture, so `360` means 360p for portrait videos too. If no quality is that small, the smallest one plays. |

```js
const src = `${embedUrl}&lang=hi&max_height=360&start=${lastSeconds}`;
```

When a video has more than one quality, the player shows a small quality menu in its corner
while paused.

#### Player events

The player tells your page what is happening with
[`postMessage`](https://developer.mozilla.org/docs/Web/API/Window/postMessage). Every event
is an object with `source: "indus-player"`, a `type`, and the `uid` from the `embed_url` path:

| `type`     | Extra fields                     | When                                                                                     |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `ready`    | `duration`                       | The video has loaded and its length (seconds) is known.                                  |
| `progress` | `seconds`, `duration`            | About every 10 s while playing, and on every pause and seek.                             |
| `ended`    |                                  | The learner watched to the end.                                                          |
| `expired`  | `seconds` (if it was playing)    | The link expired: at `expires_at`, or when an expired `embed_url` is opened.             |
| `error`    | `code`                           | The video can't play. `code` is `unsupported` (browser too old), `network`, `media` or `other`. |

The events carry positions and durations only, nothing secret, so the player sends them to
any parent page (`targetOrigin` `"*"`). On your side, accept only events from our origin:

```js
let lastSeconds = 0;
window.addEventListener("message", async (event) => {
  if (event.origin !== "https://indusai.academy" || event.data?.source !== "indus-player") return;
  const e = event.data;
  if (e.type === "progress") lastSeconds = e.seconds; // e.g. save it to resume later
  if (e.type === "ended") unlockNextLesson();
  if (e.type === "expired") {
    // Ask your backend for a fresh embed_url (it calls GET /lessons/{lessonId}/playback),
    // then reload the player where the learner was.
    const { embed_url } = await fetch(`/my-api/lessons/${lessonId}/playback`).then((r) => r.json());
    iframe.src = `${embed_url}&lang=hi&start=${e.seconds ?? lastSeconds}`;
  }
});
```

Reloading the iframe doesn't help when a link expires: it reuses the same expired link.
Always swap in a fresh `embed_url` as above.

The events come from the learner's device, so use them for the learner's experience
(resume, unlocking the next lesson). Don't treat them as proof that a lesson was watched.

#### Mobile apps (WebView)

Load `embed_url` in an iframe on a page in your WebView, as above. If you load `embed_url` as
the WebView's own page, there is no parent page to receive the events: put a small page of
your own around it (for example with `loadDataWithBaseURL` on Android or `loadHTMLString` on
iOS) and pass the events to your app through your usual JavaScript bridge.

Android (`android.webkit.WebView`):

- JavaScript enabled: `settings.javaScriptEnabled = true`.
- Fullscreen: implement `WebChromeClient.onShowCustomView` and `onHideCustomView` (show the
  view you are given over your activity, then remove it). Without them the player's
  fullscreen button does nothing.
- `settings.mediaPlaybackRequiresUserGesture = false` only if you start playback without a
  tap. The player itself waits for the learner to press play.
- Android System WebView (Chrome provides it on Android 7–9) version 87 or later, from late
  2020. Versions below 58 can't play the video. Learners can update it from the Play Store.

iOS (`WKWebView`):

- iOS 17.1 or later on iPhone. On iPad, iPadOS 13 or later.
- `WKWebViewConfiguration.allowsInlineMediaPlayback = true`, so the video plays in your
  page rather than jumping to fullscreen.

React Native WebView: `javaScriptEnabled`, `allowsFullscreenVideo` (Android),
`allowsInlineMediaPlayback` (iOS), and `mediaPlaybackRequiresUserAction={false}` only if you
autoplay.

## Live classes

Some courses have scheduled live classes, taught by our instructors. Your learners attend
them inside an iframe on your page, so they never leave your platform. Every class is
recorded.

### `GET /courses/{slug}/live-sessions`

The course's live classes, oldest first.

```json
{
  "live_sessions": [
    {
      "id": "5b0e7c1a-…",
      "title": "Week 1: Prompting basics",
      "starts_at": "2026-10-27T12:30:00.000Z",
      "duration_minutes": 120,
      "status": "open",
      "recording_url": null
    }
  ]
}
```

- `status`: `upcoming`, `open` (from 15 minutes before `starts_at` until an hour after the
  planned end) or `ended`.
- `recording_url` is set once the recording is ready, usually within a few hours of the end.
  It is a plain link that anyone who has it can play, so show it only to your learners.
- `status` is worked out when you call. A page left open doesn't change by itself: call again,
  or compare the clock with `starts_at` and `duration_minutes`.

### `POST /live-sessions/{id}/join`

A room link for one learner. Call it when the learner opens the class, with the id you used
in `PUT /learners/{external_id}`.

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"external_id":"u_123"}' \
  https://indusai.academy/api/v1/live-sessions/5b0e7c1a-…/join
```

```json
{ "embed_url": "https://…", "expires_at": "2026-10-27T12:40:00.000Z" }
```

Show it in an iframe that may use the camera and microphone:

```html
<iframe src="EMBED_URL" style="width:100%;height:80vh;border:0"
        allow="camera; microphone; autoplay; display-capture; fullscreen" allowfullscreen></iframe>
```

- The link is for that one learner. Open it before `expires_at` (at most 10 minutes away); it
  survives a few reloads. Call `join` each time the learner opens the class and use the link you
  get. If the same learner opens the class again within a few minutes you may get the same link
  back, with the same `expires_at`. Don't store links or share them between learners.
- When many learners join at once, the call can take up to about 10 seconds while the learner
  waits in line for the room. Show "Getting you into the class…" meanwhile.
- If the line is still full after that you get `503 live_busy`, with a `Retry-After` header and
  `retry_after` (seconds) in the error:

  ```json
  { "error": { "code": "live_busy", "message": "Many learners are joining right now. Retry after retry_after seconds.", "retry_after": 4 } }
  ```

  Wait `retry_after` seconds, then call `join` again. Keep the learner's page on "Getting you
  into the class…" and retry automatically rather than showing an error. If you retry on your
  own schedule, back off (for example 2, 4, 8, then 15–30 seconds) and add a random delay of
  up to a second or two, so your learners don't all retry at the same moment.
- The learner joins under the name you gave us. Their email is not passed on.
- Any of your learners can join any class of a course licensed to you: you decide who sees
  the Join button.
- The room page can take several seconds to load; a "Loading class…" note next to the
  iframe helps.
- `409 not_open_yet` before the room opens, `409 ended` after the class; `404
  learner_not_found` if you haven't created the learner yet; `503 live_busy` as above; `503
  live_unavailable` if the room can't be opened just now (retry in a few seconds). The
  `message`s are for you, not your learners.
- In v2 the learner must have an active enrolment in the class's course (`409 not_enrolled`).

### `GET /live-sessions/{id}/attendance`

Which of your learners opened the class, and whether they got into the room.

```json
{
  "status": "final",
  "synced_at": "2026-10-27T14:41:10.000Z",
  "final": true,
  "attendance": [
    {
      "external_id": "u_123",
      "opens": 2,
      "first_opened_at": "2026-10-27T12:28:10.000Z",
      "last_opened_at": "2026-10-27T12:41:52.000Z",
      "attended": true
    }
  ]
}
```

- A learner appears once `join` has given you a link for them. `opens` counts the links given
  (calls answered with `live_busy` don't count).
- After the class we read who was in the room in the background. This usually takes a few
  minutes after it ends, and longer for very large classes. Until then `status` is `pending`
  and `synced_at` is `null`. `attended` is `null` for learners not read yet, and can turn
  `true` for some learners while the rest are still being read.
- Once `status` is `final` (and `synced_at` is set), `attended` is `true` for learners who were
  in the room and `false` for those who opened it but never got in. It doesn't change after
  that. `final` is the same as `status == "final"`; it stays for existing integrations.
- The call itself is fast and never waits for that read, so polling it every few minutes is
  fine.
- Learners who never opened the class aren't listed.

## Learners and certificates

The lifecycle:

1. A learner signs up or signs in on your platform → `PUT /learners/{your_user_id}`.
2. They start a course → `POST /learners/{your_user_id}/enrolments` with the course (and the batch,
   if you know it). Optional, but it lets you list what they are taking with
   `GET /learners/{your_user_id}/courses`.
3. They finish a course → `POST /learners/{your_user_id}/completions` with the course and the batch.
   This enrols them too, if you skipped step 2.
4. You show their certificate → `GET /learners/{your_user_id}/certificates/{course}`. Until it is
   released (for example, until the batch is paid) this answers `402 payment_pending`.

`{your_user_id}` is your own id for the learner, URL-encoded: 1–200 characters, no leading
or trailing spaces. The id `bulk` is reserved. Learners are private to you: another partner's
key gets 404 for them.

We bill per enrolment: every learner enrolled in a batch counts in it, whether or not they
finish. Cancelled enrolments don't count.

### `PUT /learners/{external_id}`

Creates the learner or updates it. Safe to repeat. Answers 201 on create and 200 on update.

```sh
curl -X PUT -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.com"}' \
  https://indusai.academy/api/v1/learners/u_123
```

```json
{
  "learner": { "external_id": "u_123", "name": "Asha Rao", "email": "asha@example.com", "phone": null, "created_at": "2026-10-23T06:20:20.865Z" },
  "certificate_names_unchanged": []
}
```

- `name` (required, 1–120 characters) is printed on the certificate. Send the learner's real
  name, in the script they write it in: Hindi and other Devanagari names, and Bengali,
  Gujarati, Gurmukhi, Odia, Tamil, Telugu, Kannada and Malayalam names, print correctly. Long
  names are set smaller, on up to two lines.
- `email` and `phone` are optional, kept for contact only and never used to sign in. `phone` is
  7–15 digits, optionally starting with `+` (spaces and dashes are removed).
- A later `PUT` replaces all fields. Certificates already released keep the name they were
  issued with, and `certificate_names_unchanged` lists their serials. To reprint them with the
  new name (same serial, still valid), send `"update_certificates": true`.

### `GET /learners/{external_id}`

The learner, in the shape above (`404 learner_not_found` if there is none).

### `GET /learners?limit=<n>&cursor=<cursor>&updated_since=<time>`

All your learners, ordered by external id, a page at a time:

```json
{ "learners": [ { "external_id": "u_1", "name": "Asha Rao", "email": null, "phone": "+919876543210", "created_at": "…" } ], "next_cursor": "u_1" }
```

- `limit`: 1–500, default 100. Pass `next_cursor` back as `cursor` for the next page; it is
  `null` on the last page.
- `updated_since` (optional): only learners created or changed after that time, for a sync.

### `DELETE /learners/{external_id}`

Erases the learner, for a data-deletion request. Their name, email and phone are deleted and
their certificates are revoked (the verify page then says "revoked", without the name). Their
enrolments stay, anonymous, so batches still add up. The external id is free to use again.
Answers 204. This can't be undone.

### `POST /learners/{external_id}/enrolments`

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"course":"ai-at-work-essentials","batch":"TCS-Jan-2027","sold_by":"VLE-0042","centre":"Sitapur"}' \
  https://indusai.academy/api/v1/learners/u_123/enrolments
```

```json
{
  "enrolment": {
    "course": "ai-at-work-essentials",
    "title": "AI at Work: Essentials",
    "status": "enrolled",
    "batch": "TCS-Jan-2027",
    "sold_by": "VLE-0042",
    "centre": "Sitapur",
    "enrolled_at": "2026-10-28T05:38:50.480Z",
    "expires_at": null,
    "completed_at": null,
    "certificate": null
  }
}
```

- `course`: the slug of a course licensed to you.
- `batch` (optional, 1–100 characters): as for completions. New names create a batch, and the
  learner counts in that batch in `GET /batches` from now on.
- `sold_by` and `centre` (optional, 1–100 characters each): your own ids for who sold the
  enrolment and where, such as an agent and their centre. They come back in every listing, and
  `GET /batches/{name}/learners` can filter by `sold_by`.
- `enrolled_at` (optional, with a zone): when the sale happened, if you report it later.
  Defaults to now.
- `expires_at` (optional, with a zone): when access ends. After it, playback with `learner`
  stops (in v2; v1 never blocks).
- Answers 201 on a new enrolment and 200 if the learner was already enrolled. Safe to repeat;
  a repeat updates the fields you send. Until the course is completed, a repeat with a `batch`
  moves the learner to that batch (v2: not into or out of a paid batch). A repeat also
  re-activates a cancelled enrolment.

### `DELETE /learners/{external_id}/enrolments/{course}?reason=<text>`

Cancels an enrolment, for example after a refund. It stops counting in its batch, and its
videos stop playing (with `learner`; in v2). `reason` is optional, up to 100 characters, and
stays on the enrolment. Answers 204, `404 not_enrolled`, or `409 certificate_released` if its
certificate is out (revoke that first). Enrolling again re-activates it.

### `GET /learners/{external_id}/courses`

Every course the learner is enrolled in, oldest first, completed or not, in the shape above:

```json
{
  "courses": [
    {
      "course": "ai-at-work-essentials",
      "title": "AI at Work: Essentials",
      "status": "completed",
      "batch": "TCS-Jan-2027",
      "enrolled_at": "2026-10-28T05:38:50.480Z",
      "completed_at": "2026-11-02T10:00:00.000Z",
      "certificate": { "status": "pending_payment" }
    }
  ]
}
```

- `status`: `enrolled`, `completed` or `cancelled`.
- `certificate` is `null` until the course is completed. After that it is the same object as in
  [`GET /learners/{external_id}/certificates`](#get-learnersexternalidcertificates).
- We don't track lesson progress for your learners; your platform does.

### `POST /learners/{external_id}/completions`

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"course":"ai-at-work-essentials","batch":"TCS-Jan-2027","completed_at":"2026-10-23T06:00:00Z"}' \
  https://indusai.academy/api/v1/learners/u_123/completions
```

```json
{
  "completion": {
    "course": "ai-at-work-essentials",
    "batch": "TCS-Jan-2027",
    "completed_at": "2026-10-23T06:00:00.000Z",
    "certificate": { "status": "pending_payment" }
  }
}
```

- `course`: the slug of a course licensed to you.
- `batch` (1–100 characters): your name for the group this learner is billed with. New names
  create a batch.
- `completed_at`: optional, defaults to now. It can't be in the future.
- Safe to repeat. Until the certificate is released, a repeat can move the learner to another
  batch. After release it changes nothing.
- v1: a learner who was not enrolled in the course is enrolled by this call. v2: the learner
  must be enrolled already (`409 not_enrolled`). `batch` may be left out to use the
  enrolment's, and may not differ from it (`409 batch_mismatch`); if the enrolment has no batch,
  send one (`400 batch_required`).
- If the certificate can be released straight away, the response already shows it as `released`.

### `DELETE /learners/{external_id}/completions/{course}`

Takes back a completion sent by mistake. Answers 204. The learner stays enrolled, in the same
batch. Once the certificate is released this answers `409 certificate_released`; ask us to revoke it instead.

### `GET /learners/{external_id}/certificates`

Every course the learner has completed:

```json
{
  "certificates": [
    {
      "course": "ai-at-work-essentials",
      "batch": "TCS-Jan-2027",
      "completed_at": "2026-10-23T06:00:00.000Z",
      "certificate": {
        "status": "released",
        "serial": "IAA-2026-0042",
        "issued_at": "2026-10-25T09:12:00.000Z",
        "image_url": "https://indusai.academy/api/certificates/IAA-2026-0042/image",
        "verify_url": "https://indusai.academy/verify/IAA-2026-0042"
      }
    }
  ]
}
```

`certificate.status`:

| Status            | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `pending_payment` | Waiting for payment of the learner's batch                              |
| `pending_release` | Waiting for us to release it                                            |
| `released`        | Issued. `serial`, `issued_at`, `image_url` and `verify_url` are present |
| `revoked`         | Issued, then withdrawn. The verify page says so                         |
| `not_offered`     | This course does not award certificates                                 |

- `image_url` is a PNG (1600×1131). Add `?download=1` to get it as a file download.
- `verify_url` is a public page anyone, such as an employer, can use to check the certificate.
- Both are stable. Store them, or the serial.

### `GET /learners/{external_id}/certificates/{course}`

One course, in the same shape as an item above (released or revoked). Otherwise it answers
with an error: `402 payment_pending` (the message names the batch), `409 certificate_pending`,
`409 certificate_not_offered`, or `404 not_completed`.

### `POST /learners/{external_id}/certificates/{course}/revoke`

Revokes the learner's certificate, for example when it was issued by mistake. It's permanent:
the verify page says "revoked" from then on. Answers with the certificate (status `revoked`),
or `404 not_issued`.

### `GET /batches`

```json
{ "batches": [ { "name": "TCS-Jan-2027", "paid": false, "paid_at": null, "learners": 42, "completed": 40, "released": 0, "waiting": 40 } ] }
```

- `learners`: learners with an active enrolment in the batch, which is what we bill.
  `completed`: of those, how many completed. `released`: certificates out. `waiting`: completed
  in a course with certificates, certificate not out yet (for example, until the batch is paid).

### `GET /batches/{name}/learners?limit=<n>&cursor=<cursor>&sold_by=<id>`

Everyone in a batch, for reconciling our invoice with what your agents collected. Cancelled
enrolments are included, marked `cancelled`.

```json
{
  "batch": "TCS-Jan-2027",
  "learners": [
    {
      "external_id": "u_123",
      "course": "ai-at-work-essentials",
      "status": "completed",
      "sold_by": "VLE-0042",
      "centre": "Sitapur",
      "enrolled_at": "2026-10-28T05:38:50.480Z",
      "completed_at": "2026-11-02T10:00:00.000Z",
      "cancelled_at": null,
      "certificate": { "status": "pending_payment", "serial": null }
    }
  ],
  "next_cursor": null
}
```

- Paged like `GET /learners`. `sold_by` narrows it to one seller. `404 not_found` for an
  unknown batch name (exact match).

### Bulk: `POST /learners/bulk`, `POST /enrolments/bulk` and `POST /completions/bulk`

Up to 500 items per request. Each item behaves exactly like the single call, and one bad item
doesn't stop the rest.

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"learners":[{"external_id":"u_1","name":"Asha Rao"},{"external_id":"u_2","name":"Ravi K"}]}' \
  https://indusai.academy/api/v1/learners/bulk
# body for /enrolments/bulk: {"enrolments":[{"external_id":"u_1","course":"…","batch":"…","sold_by":"…"}]}
# body for /completions/bulk: {"completions":[{"external_id":"u_1","course":"…","batch":"…"}]}
```

```json
{ "results": [ { "index": 0, "ok": true }, { "index": 1, "ok": false, "error": { "code": "invalid_request", "message": "`name` is required, 1–120 characters." } } ] }
```

Completion results also carry `certificate.status`, and enrolment results `created`, for the
items that succeeded.

## Webhooks

Instead of polling, you can have us POST events to a URL of yours. Send us an `https://` URL.
We'll give you a **signing secret** (`whsec_…`), shown once. We can rotate it whenever you ask.

Events we send: `certificate.released`, `batch.paid`, `enrolment.cancelled` and `course.updated`.

Each event is one JSON POST:

```json
{
  "id": "0b7e5a5c-6f1d-4c1e-9d8e-3f2a1b4c5d6e",
  "type": "certificate.released",
  "created_at": "2026-11-02T09:30:00.000Z",
  "data": { … }
}
```

`data` depends on the type (see [Events](#events)). Headers: `content-type: application/json`,
`x-iaa-event-id` (the event's `id`), `x-iaa-event-type` and `x-iaa-signature`.

**Answer quickly with any `2xx`.** Anything else, a redirect, or no answer within 10 seconds
counts as a failure. Do the real work after you have answered.

### Verifying the signature

`x-iaa-signature: t=<unix seconds>,v1=<hex>`, where `v1` is HMAC-SHA256, keyed with your
signing secret, of `t`, a `.`, and the raw request body exactly as received. Check it before
trusting the event, and reject old timestamps so a captured request can't be replayed:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyIndusWebhook(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const got = Buffer.from(parts.v1 ?? "", "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Express: read the body raw; parsing and re-serialising the JSON changes the bytes.
app.post("/webhooks/indus", express.raw({ type: "application/json" }), (req, res) => {
  if (!verifyIndusWebhook(req.body.toString("utf8"), req.get("x-iaa-signature"), process.env.INDUS_WEBHOOK_SECRET)) {
    return res.sendStatus(400);
  }
  res.sendStatus(200);
  handle(JSON.parse(req.body)); // after answering
});
```

### Retries

A failed delivery is retried with exponential backoff: after 1, 2, 4, 8 … minutes, then every
4 hours, for 24 hours from the event. After that the event is marked failed. Once your
endpoint is fixed, ask us and we'll send failed events again. Events usually arrive within a
minute; they are not guaranteed to arrive in order.

### Duplicates

Delivery is **at least once**: rarely, the same event arrives twice (for example, if your
answer was lost). Record each event's `id` and ignore one you have already handled. A retry
keeps the same `id` but has a new `t` and signature.

### Events

| `type` | When | `data` |
| --- | --- | --- |
| `certificate.released` | A learner's certificate is issued | `external_id`, `course`, `batch`, `serial`, `issued_at`, `image_url`, `verify_url` |
| `batch.paid` | We mark a batch paid | `batch`, `paid_at`, `released` (certificates issued by it) |
| `enrolment.cancelled` | An enrolment is cancelled | `external_id`, `course`, `reason`, `cancelled_at` |
| `course.updated` | Anything in a course licensed to you changes | `course` (slug), `updated_at`. Re-fetch `GET /courses/{slug}`. Several edits in a row send several events. |

Every `data` also has `test`: `true` for events about test-key data.

## Errors

Errors share one shape:

```json
{ "error": { "code": "not_found", "message": "No such resource." } }
```

A `429` and a `503 live_busy` also carry `retry_after` (seconds) in the `error` object.
`invalid_request` also covers an `Idempotency-Key` that is empty or longer than 255 characters.

| Status | `code`                    | When                                                                    |
| ------ | ------------------------- | ----------------------------------------------------------------------- |
| 400    | `invalid_ttl`             | `ttl` is not a whole number from 300 to 86400                           |
| 401    | `unauthorized`            | Missing, malformed, unknown, rotated or revoked key                     |
| 404    | `not_found`               | Unknown course, lesson or live class, not licensed to you, or unpublished |
| 409    | `video_not_ready`         | The lesson has no playable video yet (quiz lesson, or still processing) |
| 503    | `video_unavailable`       | Video playback is temporarily unavailable; retry later                  |
| 400    | `invalid_request`         | The body or learner id is invalid; `message` says what to fix           |
| 402    | `payment_pending`         | The learner's batch is not paid yet; `message` names the batch          |
| 404    | `learner_not_found`       | No learner with that id (for your key)                                  |
| 404    | `not_completed`           | The learner has not completed that course                               |
| 409    | `certificate_pending`     | The certificate has not been released yet                               |
| 409    | `certificate_not_offered` | The course does not award certificates                                  |
| 409    | `certificate_released`    | The completion can't be taken back, or the enrolment cancelled: its certificate is released |
| 404    | `not_enrolled`            | The learner has no such enrolment (DELETE …/enrolments/{course})        |
| 403    | `not_enrolled`            | v2 playback: no active, unexpired enrolment in the course                |
| 409    | `not_enrolled`            | v2 completion or live join: the learner isn't enrolled in the course     |
| 409    | `batch_closed`            | v2: the batch is paid; nobody can join or leave it                       |
| 409    | `batch_mismatch`          | v2 completion: the learner is enrolled in another batch                  |
| 400    | `batch_required`          | v2 completion: neither the request nor the enrolment names a batch      |
| 404    | `not_issued`              | No certificate has been issued for that course                           |
| 409    | `not_a_quiz`              | Grading a lesson that is not a quiz                                      |
| 409    | `not_open_yet`            | The live class's room opens 15 minutes before `starts_at`               |
| 409    | `ended`                   | The live class is over; use `recording_url`                             |
| 503    | `live_unavailable`        | The live room can't be opened just now; retry in a few seconds          |
| 409    | `idempotency_conflict` | The `Idempotency-Key` was already used for a different request                |
| 409    | `request_in_progress`  | A request with this `Idempotency-Key` is still running; retry in a few seconds |
| 429    | `rate_limited`         | Over your rate limit; wait `retry_after` seconds (also in `Retry-After`)       |
| 500    | `internal_error`       | Something failed on our side; retry later, and tell us if it keeps happening   |
| 503    | `live_busy`               | Many learners are joining the live class at once; retry after `retry_after` seconds (also in `Retry-After`) |

## Changelog

### 28 Oct 2026: enrolments, v2, and more for large partners

- **New version, v2**, alongside v1 (which is unchanged). See [Versions](#versions).
- Enrolments: [`POST /learners/{external_id}/enrolments`](#post-learnersexternalidenrolments)
  with `sold_by`, `centre`, `enrolled_at` and `expires_at`;
  [cancelling one](#delete-learnersexternalidenrolmentscoursereasontext); `POST /enrolments/bulk`;
  and [`GET /learners/{external_id}/courses`](#get-learnersexternalidcourses).
- Learners: `phone`; `GET`, `DELETE` (erase) and a paged [`GET /learners`](#get-learnerslimitnandcursorcursorandupdatedsincetime);
  `update_certificates` and `certificate_names_unchanged` on `PUT`.
- Batches: [`GET /batches/{name}/learners`](#get-batchesnamelearnerslimitnandcursorcursorandsoldbyid),
  `waiting` on `GET /batches`. `learners` now counts everyone enrolled in the batch, not only
  those who completed; cancelled enrolments don't count.
- Certificates: [`POST …/certificates/{course}/revoke`](#post-learnersexternalidcertificatescourserevoke).
- Courses: `language`, `cover_image_url`, per-lesson `updated_at`, quiz `option_ids`, and
  [`POST /lessons/{id}/grade`](#post-lessonslessonidgrade). A course's `updated_at` now also
  moves when a lesson, quiz or video changes.
- Playback: optional `learner`; enrolled learners keep access to courses that are unpublished
  or unlicensed later. The player sends [events](#player-events) to your page (`ready`,
  `progress`, `ended`, `expired`, `error`) and accepts [`lang`, `start` and
  `max_height`](#player-options); existing `embed_url`s play as before.
- Live classes: `join` waits in line for up to about 10 seconds when many learners join at
  once, returns the same link for a quick repeat join, and answers `503 live_busy` with
  `retry_after` when the line is full. Attendance gains `status` and `synced_at` and answers
  at once.
- Certificates print names in Indian scripts correctly, and fit long names on up to two lines.
- **Rate limits**: 120 requests a minute per key unless agreed otherwise, with `ratelimit`
  headers and `429 rate_limited`. This is new behaviour: if you send bursts, handle `429` by
  waiting `retry_after` seconds.
- Errors on our side now come as `500 internal_error` in the usual error shape.
- `Idempotency-Key` on `POST` and `PUT`; signed [webhooks](#webhooks); two live keys at once
  for rotation without downtime; and test keys (`iaa_test_…`) that act in a sandbox.

### 26 Oct 2026: live classes

New: [`GET /courses/{slug}/live-sessions`](#get-coursessluglive-sessions),
[`POST /live-sessions/{id}/join`](#post-live-sessionsidjoin) and
[`GET /live-sessions/{id}/attendance`](#get-live-sessionsidattendance). Nothing existing changed.

### 23 Oct 2026: video playback moved to an embedded player (action needed)

`GET /lessons/{lessonId}/playback` no longer returns `hls` (a playlist URL you played in
your own player). It returns `embed_url`, a page with our player that you show in an
iframe. Our videos are now encrypted, so the old playlist URLs, and any player other than
ours, can no longer play them. This is the one exception to the rule below, made to stop
course videos being downloaded.

What to change on your side:

1. Wherever you read `hls` from the playback response, read `embed_url` instead.
2. Replace your video player (hls.js, video.js, `<video src>`, a native player…) with an
   iframe whose `src` is `embed_url`, as shown under
   [`GET /lessons/{lessonId}/playback`](#get-lessonslessonidplaybackttlsecondsandlearnerexternalid).
3. Fetch a fresh `embed_url` each time a learner opens the lesson; don't store it.
4. Remove any code that downloads, proxies or caches our playlists or video segments: it
   only gets encrypted bytes now.

Nothing else changed: the same key, the same lesson ids, and `thumbnail` and `expires_at`
mean what they did. Mobile apps show `embed_url` in a WebView.

## Versioning

The version is in the path. Within a version we only add things: new fields, endpoints or
error codes, so ignore fields you do not know. Breaking changes come in a new version,
announced in advance, and older versions keep working. v1 and v2 are both current.
