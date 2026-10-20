# Indus AI Academy distributor API (v1)

For partner platforms licensed to deliver our courses. You get each licensed course's
structure, its quizzes (with answers) and short-lived signed video URLs, and you run
enrolment, progress and certificates on your own platform.

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

Signed URLs for one video lesson. Request them when a learner starts watching.

```sh
curl -H "Authorization: Bearer $IAA_KEY" \
  "https://indusai.academy/api/v1/lessons/7f6a95e5-028b-47c7-9bca-a74d5ed4531e/playback?ttl=7200"
```

```json
{
  "hls": "https://…/eyJhbGciOi…/manifest/video.m3u8",
  "iframe": "https://…/eyJhbGciOi…/iframe",
  "thumbnail": "https://…/eyJhbGciOi…/thumbnails/thumbnail.jpg",
  "expires_at": "2026-10-20T08:26:01.000Z"
}
```

- `ttl`: how long the URLs stay valid, in seconds. Default 21600 (6 h), minimum 300
  (5 min), maximum 86400 (24 h).
- **Expiry.** Video segments are fetched with the same signature, so playback that is
  still running at `expires_at` fails. Pick a `ttl` longer than the viewing session
  (lesson length plus pauses), and fetch fresh URLs for each session rather than caching
  them. The URLs are bearer credentials for that one video until they expire: hand them
  only to the learner who is watching.
- Playing it:
  - **hls.js** (Chrome, Firefox, Edge): `const hls = new Hls(); hls.loadSource(hls_url); hls.attachMedia(videoElement);`
  - **Safari / iOS**: plays HLS natively: `videoElement.src = hls_url`.
  - **Simplest**: embed the hosted player: `<iframe src="{iframe}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`.
  - Use `thumbnail` as the poster image.

## Errors

Errors share one shape:

```json
{ "error": { "code": "not_found", "message": "No such resource." } }
```

| Status | `code`              | When                                                                  |
| ------ | ------------------- | --------------------------------------------------------------------- |
| 400    | `invalid_ttl`       | `ttl` is not a whole number from 300 to 86400                          |
| 401    | `unauthorized`      | Missing, malformed, unknown, rotated or revoked key                    |
| 404    | `not_found`         | Unknown course or lesson, or not licensed to you, or not published     |
| 409    | `video_not_ready`   | The lesson has no playable video yet (quiz lesson, or still processing) |
| 503    | `video_unavailable` | Video playback is temporarily unavailable; retry later                 |

## Versioning

The version is in the path. Within `v1` we only add things: new fields, endpoints or error
codes, so ignore fields you do not know. Breaking changes come in a new version
(`/api/v2`), announced in advance.
