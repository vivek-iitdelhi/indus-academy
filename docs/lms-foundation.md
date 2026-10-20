# LMS foundation: the contract

Read this first. It overrides `lms-plan.md`, `lms-schema.md` and `lms-phase-1.md` where
they disagree: Postgres is **Supabase** (Drizzle + postgres.js), auth is **Better Auth**,
course structure lives **in the database**, video is **Cloudflare Stream**.

## Rules every agent follows

1. **Always call `hasAccess`** (or `canViewLesson` for previews) before serving a lesson,
   a playback token, progress or a quiz. Never re-derive the enrolment rule.
2. **Only `src/lib/video.ts` names Cloudflare.** Elsewhere a video is an opaque `videoUid`.
3. **Marketing stays static.** Never read cookies/headers/session in the root layout,
   `SiteHeader` or marketing pages. After any change, `npm run build` must still show
   `/`, `/programs`, `/blog/...`, `/enterprise` as ○ or ●.
4. **No `proxy.ts` / middleware.** Auth is checked in layouts, pages, route handlers and
   server actions. Layouts do not re-run on client navigation, so **every page, route
   handler and server action checks auth itself** (the layouts' checks are a backstop).
5. **Schema changes only through new Drizzle migrations**: edit `src/db/schema.ts`, run
   `npm run db:generate -- --name <what>`, commit the SQL. Never edit an applied migration.
   While feature agents work in parallel, **they do not generate migrations** (journal
   numbers would collide): if you need a column, stop and report it to the reviewer.
7. **Email goes through `sendEmail(payload)` in `@/lib/email`** (Resend body; never
   throws; logs and skips without `RESEND_API_KEY`). Use `shell`/`escapeHtml` from
   `@/lib/newsletter` for the visual frame.
8. `hls.js` (player) and `tus-js-client` (admin uploads) are already installed. Do not add
   other dependencies without a reason you state in your report.
6. Inside `src/db` and `src/lib/lms`, import with **relative paths and `.ts` extensions**
   and use `import type` for types, so `node --test` can load them. Elsewhere use `@/`.

## Running it locally

```sh
createdb indus_lms                       # local Postgres 16, no password
# .env.local: DATABASE_URL=postgres://localhost/indus_lms, BETTER_AUTH_SECRET=<random>,
#             BETTER_AUTH_URL=http://localhost:3000, ADMIN_EMAILS=you@x.com, CERTIFICATE_SECRET=<random>
npm run db:migrate && npm run db:seed   # seed is idempotent (upserts by slug)
npm test                                # node --test on src/**/*.test.ts
npm run dev                             # without RESEND_API_KEY, magic links print to the console
```

Seeded: `ai-at-work-essentials` (interactive, sequential, ₹1,499, 2 chapters of
video → quiz → video; first video is a preview) and `chatgpt-for-professionals`
(standard, ₹999, one 3 h video). Video UIDs are placeholders (`seed-video-N`).

## Database: `src/db`

- `db` from `@/db`: one postgres.js client per process, `prepare: false` (Supabase
  transaction pooler), survives dev HMR. `schema` is re-exported.
- `src/db/schema.ts`: tables `user session account verification` (Better Auth),
  `courses chapters lessons quiz_questions quiz_attempts lesson_progress enrollments
  payments certificates distributors distributor_courses`, plus row types (`Course`,
  `Lesson`, `Enrollment`, …) and enum arrays/unions (`courseFormats`/`CourseFormat`,
  `courseStatuses`, `lessonKinds`, `enrollmentSources`, `enrollmentStatuses`,
  `paymentStatuses`, `distributorStatuses`).
- Ids are uuids except Better Auth's (text). `user.id` is text; every `user_id` is text.
- Prices are `price_paise` (GST-inclusive, 0 = free). Lesson `position` is course-wide
  order; chapter `position` orders chapters. `quiz_questions.correct` holds option
  indices (more than one = multi-select).
- `enrollments.nudged_at`: when the idle-learner reminder was last sent.
  `payments.razorpay_refund_id`: set when an admin refunds.
- Deleting a course with enrolments/payments/certificates is blocked: archive it. A user
  with certificates or payments cannot be hard-deleted without handling those first.

## Auth: `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-client.ts`

- Better Auth at `/api/auth/*`: magic link (Resend; 15 min, single use) and Google
  (only when `AUTH_GOOGLE_ID`/`SECRET` are set). 30-day rolling session. Google and
  magic link link to one user by email. `user.phone` is an additional field.
- **`user.name` is empty for magic-link sign-ups.** It is the name printed on
  certificates, so the learner app must ask for it before a course can complete.
- Server helpers (`@/lib/session`):
  - `getUser(): Promise<SessionUser | null>` — memoised per request.
  - `requireUser(nextPath: string): Promise<SessionUser>` — else redirects to `/signin?next=`.
  - `isAdminEmail(email): boolean` — `ADMIN_EMAILS`, comma-separated, case-insensitive.
  - `requireAdmin(): Promise<SessionUser>` — pages/layouts; anyone else gets `notFound()`.
  - `requireAdminApi()` — the same check for **route handlers and server actions**: it
    throws `notFound()`, which Next answers with 404 there too. Call it first, outside
    any `try/catch`: `const admin = await requireAdminApi();`
- Client: `authClient` (`better-auth/react` + magic link) for `signIn.magicLink`,
  `signIn.social`, `signOut`, `useSession`. `<SignOutButton />` in `@/components/sign-out-button`.
- `/signin?next=/path` (same-site paths only, via `safeNextPath` in `@/lib/safe-next`).
  Failed/expired/reused links come back as `/signin?error=...` with a resend form.

## LMS core: `src/lib/lms/*`

`access.ts`
- `hasAccess(userId, courseId): Promise<boolean>` — THE rule: enrolment `status='active'`
  and `expires_at` null or in the future.
- `canViewLesson(user | null, lesson: {courseId, isPreview}): Promise<boolean>` — previews open to all.

`courses.ts` (types `CourseOutline = OutlineChapter[]`, `OutlineChapter = Chapter & {lessons}`, `ProgressRow`)
- `getCourseBySlug(slug, {includeDrafts?}): Promise<Course | null>` — drafts hidden by
  default; archived still returned (enrolled learners keep access). Sell only `published`.
- `getCourseOutline(courseId): Promise<CourseOutline>` — chapters and lessons, in order.
- `getLesson(courseSlug, lessonSlug): Promise<{course, lesson} | null>` — no access check.
- `flattenOutline(outline): Lesson[]`, `totalDurationSeconds(outline): number`.
- `nextIncompleteLesson(outline, progress): Lesson | null` — the "continue" target.
- `isLessonUnlocked(outline, progress, lessonId, sequential): boolean` — sequential
  courses unlock after every earlier lesson is complete; previews always open. Enforce it
  where lessons, tokens and quizzes are served.

`progress.ts`
- `applyProgressReport(prev, {position, watchedDelta}, durationSeconds, now): ProgressState` — pure.
- `recordProgress(userId, lessonId, report): Promise<{progress, newlyCompleted, certificate} | null>`
  — checks `hasAccess` (null = no access/unknown lesson, so previews are not tracked),
  upserts monotonically, runs `onLessonCompleted` on a new completion.
- `getCourseProgress(userId, courseId): Promise<LessonProgress[]>`.
- **Anti-scrub rule.** The player reports at most every 15 s while playing, plus on pause
  and `visibilitychange`: `position` (playhead) and `watchedDelta` (media seconds actually
  played since the last report). The server clamps `watchedDelta` to 0..30 and lets
  `furthest_seconds` advance only to `min(position, previous furthest + watchedDelta + 5)`.
  Dragging to the end moves nothing; only watching does. Completion is set once when
  `furthest_seconds >= 0.9 × duration` (never for duration 0) and never cleared.

`quiz.ts`
- `gradeQuiz(questions, answers, passPercent = 70): {scorePercent, passed, perQuestion: boolean[]}`
  — pure; `answers[i]` answers the i-th question by position; exact-set match; empty quiz passes.
- `submitQuiz(userId, lessonId, answers): Promise<QuizGrade & {attemptId, certificate} | null>`
  — checks `hasAccess` and `kind === 'quiz'`, stores the attempt, a pass completes the
  lesson and runs `onLessonCompleted`. Correct answers are never returned.

`completion.ts`
- `isCourseComplete(userId, courseId): Promise<boolean>` — every lesson has `completed_at`.
- `onLessonCompleted(userId, courseId): Promise<Certificate | null>` — issues the
  certificate when the course is complete and `certificate_enabled`.

`certificates.ts`
- `issueCertificate(userId, courseId): Promise<Certificate>` — idempotent and race-safe;
  serial `IAA-<year in IST>-<0001…>` from `certificate_serial_seq`; snapshots `user.name`.
- `getCertificate(serial): Promise<{certificate, courseTitle, courseSlug} | null>`.
- `verifyCertificateHash(cert): boolean` — HMAC-SHA256(`CERTIFICATE_SECRET`) over
  `serial|user_id|course_id|issued_at ISO`. Revoke by setting `revoked_at`; never delete.
- Pure helpers: `formatSerial(year, n)`, `certificateHash(cert, secret?)`.

## Video: `src/lib/video.ts` (the only Cloudflare file)

- `videoConfigured(): boolean` — all five `CLOUDFLARE_*` vars set.
- `createDirectUpload({maxDurationSeconds, name}): Promise<{uploadUrl, uid}>` — one-time
  URL; the browser POSTs multipart field `file`. Up to 200 MB.
- `createTusUpload({uploadLength, maxDurationSeconds, name, creator?}): Promise<{uploadUrl, uid}>`
  — for large files. Back an admin route used as tus-js-client's `endpoint`: on its POST,
  read `Upload-Length`, call this, reply `201` with `Location: uploadUrl` and
  `Access-Control-Expose-Headers: Location`. Chunk size: multiple of 256 KiB, ≥ 5 MiB.
- Every upload sets `requireSignedURLs`. Save `uid` on the lesson right away.
- `getVideoStatus(uid): Promise<{ready, durationSeconds, thumbnailUrl, state}>` — poll
  after upload; copy `durationSeconds` into `lessons.duration_seconds` (completion needs it).
- `deleteVideo(uid): Promise<void>` (404 tolerated).
- `signPlaybackToken(uid, ttlSeconds = 6 h): string` — RS256 JWT (`kid`, `sub`, `nbf`,
  `exp`, max 24 h), signed locally. Mint only after `canViewLesson` (+ unlock check).
- `hlsManifestUrl(token)`, `iframeUrl(token)`, `thumbnailUrl(token)`.

## Route shells

- `/admin` (`requireAdmin`): overview counts; placeholders at `/admin/courses`,
  `/admin/learners`, `/admin/payments`, `/admin/certificates`, `/admin/distributors`.
  Replace your section's `page.tsx`; add links in `src/app/admin/admin-nav.tsx`.
- `/learn` (`requireUser`): placeholder dashboard. Nested pages go under `src/app/learn/`.
- `/admin`, `/learn`, `/signin` are disallowed in `robots.txt`, absent from the sitemap,
  and `noindex`. They render inside the marketing header/footer (root layout unchanged).
