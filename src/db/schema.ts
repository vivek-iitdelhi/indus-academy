import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Answers, FormItem, FormSettings } from "../lib/forms/types.ts";

// Shared column helpers. Every timestamp is timestamptz.
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const id = () => uuid("id").primaryKey().defaultRandom();

// Text enums: the arrays are the source of truth for the TS unions below.
export const courseFormats = ["interactive", "standard"] as const;
export const courseStatuses = ["draft", "published", "archived"] as const;
export const lessonKinds = ["video", "quiz"] as const;
export const enrollmentSources = ["purchase", "cohort", "free", "manual", "distributor"] as const;
export const enrollmentStatuses = ["active", "revoked"] as const;
export const paymentStatuses = ["created", "paid", "failed", "refunded"] as const;
export const distributorStatuses = ["active", "revoked"] as const;
export const bookingStatuses = ["held", "confirmed"] as const;
export const certificateReleaseModes = ["on_payment", "on_completion", "manual"] as const;

export type CourseFormat = (typeof courseFormats)[number];
export type CourseStatus = (typeof courseStatuses)[number];
export type LessonKind = (typeof lessonKinds)[number];
export type EnrollmentSource = (typeof enrollmentSources)[number];
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type DistributorStatus = (typeof distributorStatuses)[number];
export type CertificateReleaseMode = (typeof certificateReleaseModes)[number];

// ---------------------------------------------------------------------------
// Better Auth tables. Shape follows its Drizzle adapter; ids are Better Auth's own text ids.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  // The name printed on certificates.
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Better Auth additionalField (see src/lib/auth.ts); the payment gateway needs it at checkout.
  phone: text("phone"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Course structure (edited from the admin panel).

export const courses = pgTable("courses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"), // markdown
  format: text("format", { enum: courseFormats }).notNull(),
  status: text("status", { enum: courseStatuses }).notNull().default("draft"),
  // 0 = free. GST-inclusive.
  pricePaise: integer("price_paise").notNull().default(0),
  // Shown struck through next to pricePaise when higher (a discount). Never charged.
  listPricePaise: integer("list_price_paise"),
  // If true, a lesson unlocks only after the previous one is complete.
  sequential: boolean("sequential").notNull().default(false),
  certificateEnabled: boolean("certificate_enabled").notNull().default(true),
  coverImageUrl: text("cover_image_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const chapters = pgTable(
  "chapters",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("chapters_course_id_idx").on(t.courseId)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    kind: text("kind", { enum: lessonKinds }).notNull(),
    position: integer("position").notNull(),
    summary: text("summary"),
    videoUid: text("video_uid"), // see src/lib/video.ts; video lessons only
    // A replacement still uploading/processing; promoted to video_uid once ready.
    pendingVideoUid: text("pending_video_uid"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    // Watchable without an enrolment.
    isPreview: boolean("is_preview").notNull().default(false),
    passPercent: integer("pass_percent").notNull().default(70), // quiz lessons
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("lessons_course_id_slug_unique").on(t.courseId, t.slug), index("lessons_chapter_id_idx").on(t.chapterId)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: id(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    // Indices into options; more than one entry means multi-select.
    correct: jsonb("correct").$type<number[]>().notNull(),
    explanation: text("explanation"),
  },
  (t) => [index("quiz_questions_lesson_id_idx").on(t.lessonId)],
);

// ---------------------------------------------------------------------------
// Learner state.

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<number[][]>().notNull(),
    scorePercent: integer("score_percent").notNull(),
    passed: boolean("passed").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quiz_attempts_user_id_lesson_id_idx").on(t.userId, t.lessonId)],
);

// The primary key (user_id, lesson_id) already serves user_id lookups; no separate index.
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    // Total media seconds played; engagement only.
    secondsWatched: integer("seconds_watched").notNull().default(0),
    // High-water mark of position reached; decides completion.
    furthestSeconds: integer("furthest_seconds").notNull().default(0),
    completedAt: ts("completed_at"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

/** Who can open /admin, by sign-in email (stored lower-case). Managed at /admin/admins. */
export const admins = pgTable("admins", {
  email: text("email").primaryKey(),
  addedBy: text("added_by"),
  createdAt: createdAt(),
});

export const distributors = pgTable("distributors", {
  id: id(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  keyPrefix: text("key_prefix").notNull(), // first ~8 chars, for display
  keyHash: text("key_hash").notNull().unique(), // sha256 hex of the full key
  status: text("status", { enum: distributorStatuses }).notNull().default("active"),
  // Printed on co-branded certificates ("Delivered in partnership with …"); null = plain.
  certificateName: text("certificate_name"),
  // When partner learners' certificates are issued (docs/distributor-api.md).
  certificateRelease: text("certificate_release", { enum: certificateReleaseModes }).notNull().default("on_payment"),
  createdAt: createdAt(),
  lastUsedAt: ts("last_used_at"),
});

// Which courses a distributor is licensed to enrol learners into.
export const distributorCourses = pgTable(
  "distributor_courses",
  {
    distributorId: uuid("distributor_id")
      .notNull()
      .references(() => distributors.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.distributorId, t.courseId] })],
);

// A client's group of learners whose certificates are paid for together. Created on first use.
export const distributorBatches = pgTable(
  "distributor_batches",
  {
    id: id(),
    distributorId: uuid("distributor_id")
      .notNull()
      .references(() => distributors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    paidAt: ts("paid_at"), // set = paid
    paidBy: text("paid_by"), // admin email
    createdAt: createdAt(),
  },
  (t) => [unique("distributor_batches_distributor_id_name_unique").on(t.distributorId, t.name)],
);

/** Every flip of a batch's "Payment received" toggle. */
export const batchPaymentEvents = pgTable(
  "batch_payment_events",
  {
    id: id(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => distributorBatches.id, { onDelete: "cascade" }),
    paid: boolean("paid").notNull(),
    by: text("by").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("batch_payment_events_batch_id_idx").on(t.batchId)],
);

// A client's learner: their user id on the client's platform, mapped to our own user row.
// Never merged with direct customers, even on the same email.
export const partnerLearners = pgTable(
  "partner_learners",
  {
    distributorId: uuid("distributor_id")
      .notNull()
      .references(() => distributors.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email"), // contact only; never used to sign in or to match accounts
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.distributorId, t.externalId] })],
);

// unique(user_id, course_id) leads with user_id, so it also serves user_id lookups.
export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // No cascade: a course with enrolments is archived, not deleted.
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    source: text("source", { enum: enrollmentSources }).notNull(),
    status: text("status", { enum: enrollmentStatuses }).notNull().default("active"),
    cohortId: text("cohort_id"),
    distributorId: uuid("distributor_id").references(() => distributors.id),
    batchId: uuid("batch_id").references(() => distributorBatches.id), // partner enrolments
    completedAt: ts("completed_at"), // partner enrolments: the completion the client reported
    startedAt: ts("started_at").notNull().defaultNow(),
    expiresAt: ts("expires_at"), // null = never
    nudgedAt: ts("nudged_at"), // last "pick up where you left off" email, so it is sent once per idle spell
  },
  (t) => [
    unique("enrollments_user_id_course_id_unique").on(t.userId, t.courseId),
    index("enrollments_batch_id_idx").on(t.batchId),
    index("enrollments_distributor_id_idx").on(t.distributorId),
  ],
);

export const payments = pgTable("payments", {
  id: id(),
  // Ids at the payment gateway (Cashfree): our order id, and its payment id once paid.
  orderId: text("order_id").notNull().unique(),
  paymentId: text("payment_id").unique(),
  // Financial records outlive the account, so no cascade.
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status", { enum: paymentStatuses }).notNull().default("created"),
  refundId: text("refund_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Numbers the serials: IAA-<year>-<nextval, zero-padded to 4>.
/** Last certificate number issued in each year (India time); serials restart at 0001 every year. */
export const certificateCounters = pgTable("certificate_counters", {
  year: integer("year").primaryKey(),
  last: integer("last").notNull(),
});

// unique(user_id, course_id) leads with user_id, so it also serves user_id lookups.
export const certificates = pgTable(
  "certificates",
  {
    serial: text("serial").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    holderName: text("holder_name").notNull(), // snapshot of user.name at issue
    issuedAt: ts("issued_at").notNull(),
    revokedAt: ts("revoked_at"), // set, never deleted: verification must answer "revoked"
    // The holder can keep their verification page out of search engines; it stays public by link.
    searchVisible: boolean("search_visible").notNull().default(true),
    partnerName: text("partner_name"), // snapshot of distributors.certificate_name at issue; not hashed
    hash: text("hash").notNull(),
  },
  (t) => [unique("certificates_user_id_course_id_unique").on(t.userId, t.courseId)],
);

// ---------------------------------------------------------------------------
// GST invoices, one per paid order (program seat or course). Numbered IAA/<fy>/<n>.

/** Last invoice number issued in each financial year ("26-27"). GST wants no gaps. */
export const invoiceCounters = pgTable("invoice_counters", {
  fy: text("fy").primaryKey(),
  last: integer("last").notNull(),
});

// Rows are a legal record: a snapshot of what was billed, never edited. The id is the
// unguessable part of the buyer's /invoice/<id> link.
export const invoices = pgTable("invoices", {
  id: id(),
  number: text("number").notNull().unique(),
  orderId: text("order_id").notNull().unique(),
  paymentId: text("payment_id").notNull(),
  description: text("description").notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone"),
  // Set when the buyer asked for a GST (B2B) invoice.
  buyerGstin: text("buyer_gstin"),
  buyerCompany: text("buyer_company"),
  buyerAddress: text("buyer_address"),
  placeOfSupply: text("place_of_supply").notNull(), // state code, e.g. "09"
  supplierGstin: text("supplier_gstin").notNull(),
  taxablePaise: integer("taxable_paise").notNull(),
  cgstPaise: integer("cgst_paise").notNull(),
  sgstPaise: integer("sgst_paise").notNull(),
  igstPaise: integer("igst_paise").notNull(),
  totalPaise: integer("total_paise").notNull(),
  issuedAt: ts("issued_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Paid discovery calls (/consulting/book). A slot is held while the buyer pays, then
// confirmed; an expired hold no longer blocks the slot but stays as a record.

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    orderId: text("order_id").notNull().unique(), // Cashfree order
    paymentId: text("payment_id"),
    startsAt: ts("starts_at").notNull(),
    status: text("status", { enum: bookingStatuses }).notNull().default("held"),
    heldUntil: ts("held_until").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    company: text("company"),
    notes: text("notes").notNull().default(""),
    // Set when the buyer asked for a GST invoice; `company` is then the registered name.
    gstin: text("gstin"),
    billingAddress: text("billing_address"),
    amountPaise: integer("amount_paise").notNull(),
    // This call's own video link, made when the booking is confirmed, and its event on the
    // connected Google Calendar (null when the link is a Jitsi fallback).
    meetingUrl: text("meeting_url"),
    googleEventId: text("google_event_id"),
    createdAt: createdAt(),
  },
  // At most one confirmed booking per slot, whatever races the app loses.
  (t) => [
    uniqueIndex("bookings_confirmed_slot_unique").on(t.startsAt).where(sql`${t.status} = 'confirmed'`),
    index("bookings_starts_at_idx").on(t.startsAt),
  ],
);

/**
 * The Google account an admin connected at /admin (one row, id "google"): discovery calls
 * go on its calendar with a Meet link, and its busy times are not offered as slots.
 */
export const calendarConnections = pgTable("calendar_connections", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  connectedBy: text("connected_by").notNull(), // admin email
  connectedAt: ts("connected_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Forms (Google Forms-style, built at /admin/forms, filled in at /forms/<slug>).

export const forms = pgTable("forms", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // Questions and layout, in order. See src/lib/forms/types.ts.
  items: jsonb("items").$type<FormItem[]>().notNull().default([]),
  settings: jsonb("settings").$type<FormSettings>().notNull(),
  accepting: boolean("accepting").notNull().default(false),
  createdBy: text("created_by"), // admin email
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const formResponses = pgTable(
  "form_responses",
  {
    id: id(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    // Set when the respondent was signed in; kept if the account goes.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email"),
    answers: jsonb("answers").$type<Answers>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("form_responses_form_id_created_at_idx").on(t.formId, t.createdAt), index("form_responses_user_id_idx").on(t.userId)],
);

export type User = typeof user.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Distributor = typeof distributors.$inferSelect;
export type Form = typeof forms.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type FormResponse = typeof formResponses.$inferSelect;
export type PartnerLearner = typeof partnerLearners.$inferSelect;
export type DistributorBatch = typeof distributorBatches.$inferSelect;
