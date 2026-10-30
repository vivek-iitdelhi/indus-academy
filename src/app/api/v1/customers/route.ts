import { site } from "@/content/site";
import { licensedCourse } from "@/lib/distributors";
import { emailEnrolled } from "@/lib/lms/lifecycle";
import { enrolLearner, parseCustomerInput, upsertCustomer, upsertLearner } from "@/lib/lms/partners";
import { isAdminEmail } from "@/lib/session";
import { signInLink } from "@/lib/sign-in-link";
import { apiError, json, notFound, withDistributor } from "../_shared";
import { isV2, readJson } from "../_learners";

const LOGIN_LINK_MS = 10 * 60_000;
const NO_FIELDS = { batch: null, soldBy: null, centre: null, enrolledAt: null, expiresAt: null };

/**
 * A customer who paid the client carries on here: enrols them and returns a one-time link to
 * redirect them with. Safe to repeat. Test keys touch no real account: no email, no link.
 */
export const POST = withDistributor(async (distributor, request) => {
  const parsed = parseCustomerInput(await readJson(request));
  if (!parsed.ok) return apiError(400, "invalid_request", parsed.message);
  const input = parsed.value;
  const course = await licensedCourse(distributor.id, input.courseSlug);
  if (!course) return notFound();

  const learner = distributor.testMode
    ? (await upsertLearner(distributor.id, input.email, input)).learner
    : await upsertCustomer(distributor.id, input);
  if (!learner) return apiError(409, "customer_conflict", "This email belongs to a customer of another partner. Contact us.");
  const result = await enrolLearner(distributor.id, learner, course.id, NO_FIELDS, { strict: isV2(request) });
  if ("refused" in result) return apiError(409, result.refused, "That enrolment can't be changed.");

  if (distributor.testMode) return json(body(input.email, course.slug, null), result.created ? 201 : 200);
  if (result.created) await emailEnrolled(input.email, learner.name, course.slug, course.title);
  // Sign-in stays theirs unless we made the account for this client: a key must never open
  // someone else's account, an admin's above all. Those customers sign in as usual.
  const mayLink = learner.directAccount && !(await isAdminEmail(input.email));
  const path = mayLink ? await signInLink(input.email, learner.name, `/learn/${course.slug}`, LOGIN_LINK_MS) : null;
  return json(body(input.email, course.slug, path), result.created ? 201 : 200);
});

const body = (email: string, course: string, loginPath: string | null) => ({
  customer: { email },
  enrolment: { course },
  login_url: loginPath && `${site.url}${loginPath}`,
  course_url: `${site.url}/learn/${course}`,
});
