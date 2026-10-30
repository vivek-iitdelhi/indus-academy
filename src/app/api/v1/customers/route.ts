import { eq } from "drizzle-orm";
import { site } from "@/content/site";
import { db } from "@/db";
import { user, type Course } from "@/db/schema";
import { licensedCourse } from "@/lib/distributors";
import { emailEnrolled } from "@/lib/lms/lifecycle";
import { enrolLearner, parseCustomerInput, upsertCustomer, upsertLearner, type Learner } from "@/lib/lms/partners";
import { isAdminEmail } from "@/lib/session";
import { signInLink } from "@/lib/sign-in-link";
import { apiError, json, notFound, withDistributor } from "../_shared";
import { isV2, readJson } from "../_learners";

const LOGIN_LINK_MS = 10 * 60_000;
const NO_FIELDS = { batch: null, soldBy: null, centre: null, enrolledAt: null, expiresAt: null };

/**
 * Enrols the client's customer in a course and returns a one-time link for them to sign in. Safe
 * to repeat. A test key works on a sandbox account nobody can reach, so it sends no email.
 */
// ponytail: a sandbox customer who finishes a course through the site gets an ordinary certificate
// (only partner completions are marked TEST); make issuing sandbox-aware if clients do that.
export const POST = withDistributor(async (distributor, request) => {
  const parsed = parseCustomerInput(await readJson(request));
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.value;
  const course = await licensedCourse(distributor.id, input.course);
  if (!course) return notFound();

  const learner = distributor.testMode
    ? (await upsertLearner(distributor.id, input.email, input)).learner
    : await upsertCustomer(distributor.id, input);
  if (!learner) return apiError(409, "customer_conflict", "This email belongs to a customer of another partner. Contact us.");
  const result = await enrolLearner(distributor.id, learner, course.id, NO_FIELDS, { strict: isV2(request) });
  if ("refused" in result) return apiError(409, result.refused, "That enrolment can't be changed.");
  if (result.created && !distributor.testMode) await emailEnrolled(input.email, learner.name, course.slug, course.title);

  const loginEmail = await emailToLink(learner, input.email, distributor.testMode);
  const loginPath = loginEmail && (await signInLink(loginEmail, learner.name, `/learn/${course.slug}`, LOGIN_LINK_MS));
  return json(body(learner, input.email, course, loginPath), result.created ? 201 : 200);
});

/**
 * Whose sign-in the key may hand out. Only an account we made for this client (or its sandbox
 * one): a key must never open someone's own account, an admin's above all. They sign in as usual.
 */
async function emailToLink(learner: Learner, email: string, testMode: boolean) {
  if (testMode) {
    const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, learner.userId));
    return account.email;
  }
  return learner.directAccount && !(await isAdminEmail(email)) ? email : null;
}

const body = (learner: Learner, email: string, course: Course, loginPath: string | null) => ({
  customer: { name: learner.name, email, mobile: learner.phone, state: learner.state, district: learner.district },
  enrolment: { course_id: course.id, course: course.slug, title: course.title },
  login_url: loginPath && `${site.url}${loginPath}`,
  course_url: `${site.url}/learn/${course.slug}`,
});
