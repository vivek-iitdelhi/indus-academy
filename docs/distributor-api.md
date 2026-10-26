# Indus AI Academy distributor API (v1)

For partner platforms licensed to deliver our courses. You get each licensed course's
structure, its quizzes (with answers) and a protected video player to embed, and you run
enrolment, progress and grading on your own platform. You tell us about your learners and
their completions, and we issue our certificate for them, co-branded with your name, when
it is released under the terms agreed with you (for example, once the batch is paid).

Base URL: `https://indusai.academy/api/v1`

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
- A rotated or revoked key stops working immediately.

All responses are JSON with `Cache-Control: no-store`. You see only courses that are
licensed to you and currently published; anything else answers 404, whether or not it
exists.

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
- Use `updated_at` to decide when to re-sync a course.

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

### `GET /lessons/{lessonId}/playback?ttl=<seconds>`

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
- `ttl`: how long the player link stays valid, in seconds. Default 21600 (6 h), minimum
  300 (5 min), maximum 86400 (24 h).
- **Expiry.** Playback that is still running at `expires_at` stops. Pick a `ttl` longer
  than the viewing session (lesson length plus pauses), and fetch a fresh `embed_url` for
  each session rather than caching it. The link lets whoever has it watch that one video
  until it expires: put it only on the page of the learner who is watching.
- Use `thumbnail` as a placeholder image before the player loads.

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

- The link is for that one learner. It must be opened within 10 minutes and survives a few
  reloads. Fetch a new one each time the learner opens the class; don't store or share it.
- The learner joins under the name you gave us. Their email is not passed on.
- `409 not_open_yet` before the room opens, `409 ended` after the class; `404
  learner_not_found` if you haven't created the learner yet.

## Learners and certificates

The lifecycle:

1. A learner signs up or signs in on your platform → `PUT /learners/{your_user_id}`.
2. They finish a course → `POST /learners/{your_user_id}/completions` with the course and the batch.
3. You show their certificate → `GET /learners/{your_user_id}/certificates/{course}`. Until it is
   released (for example, until the batch is paid) this answers `402 payment_pending`.

`{your_user_id}` is your own id for the learner, URL-encoded: 1–200 characters, no leading
or trailing spaces. The id `bulk` is reserved. Learners are private to you: another partner's
key gets 404 for them.

### `PUT /learners/{external_id}`

Creates the learner or updates it. Safe to repeat. Answers 201 on create and 200 on update.

```sh
curl -X PUT -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.com"}' \
  https://indusai.academy/api/v1/learners/u_123
```

```json
{ "learner": { "external_id": "u_123", "name": "Asha Rao", "email": "asha@example.com", "created_at": "2026-10-23T06:20:20.865Z" } }
```

- `name` (required, 1–120 characters) is printed on the certificate. Send the learner's real name.
- `email` is optional. It is kept for contact only and never used to sign in.
- A later `PUT` replaces both fields. Certificates already released keep the name they were issued
  with; ask us to correct one.

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
- If the certificate can be released straight away, the response already shows it as `released`.

### `DELETE /learners/{external_id}/completions/{course}`

Takes back a completion sent by mistake. Answers 204. Once the certificate is released this
answers `409 certificate_released`; ask us to revoke it instead.

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

### `GET /batches`

```json
{ "batches": [ { "name": "TCS-Jan-2027", "paid": false, "paid_at": null, "learners": 42, "completed": 40, "released": 0 } ] }
```

### Bulk: `POST /learners/bulk` and `POST /completions/bulk`

Up to 500 items per request. Each item behaves exactly like the single call, and one bad item
doesn't stop the rest.

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"learners":[{"external_id":"u_1","name":"Asha Rao"},{"external_id":"u_2","name":"Ravi K"}]}' \
  https://indusai.academy/api/v1/learners/bulk
# body for /completions/bulk: {"completions":[{"external_id":"u_1","course":"…","batch":"…"}]}
```

```json
{ "results": [ { "index": 0, "ok": true }, { "index": 1, "ok": false, "error": { "code": "invalid_request", "message": "`name` is required, 1–120 characters." } } ] }
```

Completion results also carry `certificate.status` for the items that succeeded.

## Errors

Errors share one shape:

```json
{ "error": { "code": "not_found", "message": "No such resource." } }
```

| Status | `code`                    | When                                                                    |
| ------ | ------------------------- | ----------------------------------------------------------------------- |
| 400    | `invalid_ttl`             | `ttl` is not a whole number from 300 to 86400                           |
| 401    | `unauthorized`            | Missing, malformed, unknown, rotated or revoked key                     |
| 404    | `not_found`               | Unknown course or lesson, or not licensed to you, or not published      |
| 409    | `video_not_ready`         | The lesson has no playable video yet (quiz lesson, or still processing) |
| 503    | `video_unavailable`       | Video playback is temporarily unavailable; retry later                  |
| 400    | `invalid_request`         | The body or learner id is invalid; `message` says what to fix           |
| 402    | `payment_pending`         | The learner's batch is not paid yet; `message` names the batch          |
| 404    | `learner_not_found`       | No learner with that id (for your key)                                  |
| 404    | `not_completed`           | The learner has not completed that course                               |
| 409    | `certificate_pending`     | The certificate has not been released yet                               |
| 409    | `certificate_not_offered` | The course does not award certificates                                  |
| 409    | `certificate_released`    | The completion can't be taken back: its certificate is released         |

## Changelog

### 26 Oct 2026: live classes

New: [`GET /courses/{slug}/live-sessions`](#get-coursesslug-live-sessions) and
[`POST /live-sessions/{id}/join`](#post-live-sessionsidjoin). Nothing existing changed.

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
   [`GET /lessons/{lessonId}/playback`](#get-lessonslessonidplaybackttlseconds).
3. Fetch a fresh `embed_url` each time a learner opens the lesson; don't store it.
4. Remove any code that downloads, proxies or caches our playlists or video segments: it
   only gets encrypted bytes now.

Nothing else changed: the same key, the same lesson ids, and `thumbnail` and `expires_at`
mean what they did. Mobile apps show `embed_url` in a WebView.

## Versioning

The version is in the path. Within `v1` we only add things: new fields, endpoints or error
codes, so ignore fields you do not know. Breaking changes come in a new version
(`/api/v2`), announced in advance.
